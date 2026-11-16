import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import pool, { query, queryOne } from "./db";
import crypto from "crypto";

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required');
}
const AUTH_SECRET = process.env.AUTH_SECRET;
const COOKIE_NAME = "linkplanter_session";

// Types
export interface User {
  id: number;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  subscription_status: "free" | "paid" | "cancelled";
  subscription_expires_at: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  session_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface SessionUser {
  id: number;
  email: string;
  subscription_status: "free" | "paid" | "cancelled";
  email_verified: boolean;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Token generation
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

// JWT session management.
// The token carries only the user id and the user's session_version. Every
// request re-reads the user row and rejects the token when the version no
// longer matches, so logout and password reset revoke sessions server-side.
interface SessionClaims {
  id: number;
  sv: number;
}

export function createSessionToken(user: Pick<User, "id" | "session_version">): string {
  const claims: SessionClaims = { id: user.id, sv: user.session_version };
  return jwt.sign(claims, AUTH_SECRET, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as Partial<SessionClaims>;
    // Tokens issued before session versions existed carry no `sv`: reject them.
    if (typeof payload.id !== "number" || typeof payload.sv !== "number") return null;
    return { id: payload.id, sv: payload.sv };
  } catch {
    return null;
  }
}

// Cookie-based session
export async function setSessionCookie(user: User): Promise<void> {
  const token = createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;
  const user = await queryOne<User>(
    `SELECT id, email, email_verified_at, subscription_status, session_version
     FROM users WHERE id = $1 AND session_version = $2`,
    [claims.id, claims.sv]
  );
  return user ? toSessionUser(user) : null;
}

// Invalidate every session the user holds (all devices).
export async function revokeSessions(userId: number): Promise<void> {
  await query(
    "UPDATE users SET session_version = session_version + 1, updated_at = NOW() WHERE id = $1",
    [userId]
  );
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// User database operations
export async function createUser(email: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password);
  const users = await query<User>(
    `INSERT INTO users (email, password_hash) 
     VALUES ($1, $2) 
     RETURNING *`,
    [email.toLowerCase(), passwordHash]
  );
  return users[0];
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>(
    "SELECT * FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
}

export async function getUserById(id: number): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE id = $1", [id]);
}

export async function verifyUserEmail(userId: number): Promise<void> {
  await query(
    "UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1",
    [userId]
  );
}

// Email verification tokens
export async function createEmailToken(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await query(
    `INSERT INTO email_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
  return token;
}

export async function verifyEmailToken(token: string): Promise<number | null> {
  const result = await queryOne<{ user_id: number }>(
    `UPDATE email_tokens 
     SET used_at = NOW() 
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL 
     RETURNING user_id`,
    [token]
  );
  return result?.user_id || null;
}

// Password reset tokens
export async function createPasswordResetToken(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
  return token;
}

// Consume a reset token and set the new password in one transaction. The
// conditional UPDATE ... RETURNING claims the token atomically, so two
// concurrent requests with the same token cannot both succeed. The password
// change also bumps session_version (revoking existing sessions) and burns any
// other outstanding reset tokens for the user. Returns the user id, or null
// when the token is unknown, expired or already used.
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<number | null> {
  // Hash outside the transaction: bcrypt is slow and must not hold row locks.
  const passwordHash = await hashPassword(newPassword);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query<{ user_id: number }>(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL
       RETURNING user_id`,
      [token]
    );
    const userId = claimed.rows[0]?.user_id;
    if (!userId) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
    await client.query("COMMIT");
    return userId;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Helper to convert User to SessionUser
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    subscription_status: user.subscription_status,
    email_verified: user.email_verified_at !== null,
  };
}
