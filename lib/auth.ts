import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { query, queryOne } from "./db";
import crypto from "crypto";

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-in-production";
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

// JWT session management
export function createSessionToken(user: SessionUser): string {
  return jwt.sign(user, AUTH_SECRET, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, AUTH_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

// Cookie-based session
export async function setSessionCookie(user: SessionUser): Promise<void> {
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
  return verifySessionToken(token);
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

export async function verifyPasswordResetToken(token: string): Promise<number | null> {
  const result = await queryOne<{ user_id: number }>(
    `SELECT user_id FROM password_reset_tokens 
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [token]
  );
  return result?.user_id || null;
}

export async function usePasswordResetToken(token: string): Promise<void> {
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1`,
    [token]
  );
}

export async function updatePassword(userId: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [passwordHash, userId]
  );
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
