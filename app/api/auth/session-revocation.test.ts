import assert from "node:assert/strict";
import { before, beforeEach, describe, mock, test } from "node:test";
import bcrypt from "bcryptjs";

process.env.AUTH_SECRET ??= "test-secret-session-revocation-do-not-use";

// --- Cookie jar standing in for next/headers -------------------------------
const jar = new Map<string, string>();
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
      set: (name: string, value: string) => void jar.set(name, value),
      delete: (name: string) => void jar.delete(name),
    }),
  },
});

// --- Stubbed DB boundary ---------------------------------------------------
type UserRow = {
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
};
type ResetRow = { user_id: number; token: string; expires_at: Date; used_at: Date | null };

const users: UserRow[] = [];
const resetTokens: ResetRow[] = [];

async function runQuery(sql: string, params: unknown[] = []): Promise<unknown[]> {
  const s = sql.replace(/\s+/g, " ").trim();
  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(s)) return [];

  if (/^SELECT .* FROM users WHERE email = \$1/.test(s)) {
    return users.filter((u) => u.email === params[0]);
  }
  if (/^SELECT .* FROM users WHERE id = \$1/.test(s)) {
    return users.filter(
      (u) =>
        u.id === params[0] &&
        (!/session_version = \$2/.test(s) || u.session_version === params[1]),
    );
  }
  if (/^UPDATE users SET password_hash = \$1/.test(s)) {
    const u = users.find((x) => x.id === params[1]);
    if (u) {
      u.password_hash = params[0] as string;
      if (/session_version = session_version \+ 1/.test(s)) u.session_version += 1;
    }
    return u ? [u] : [];
  }
  if (/^UPDATE users SET session_version = session_version \+ 1/.test(s)) {
    const u = users.find((x) => x.id === params[0]);
    if (u) u.session_version += 1;
    return u ? [{ id: u.id }] : [];
  }
  if (/^SELECT user_id FROM password_reset_tokens WHERE token = \$1 AND expires_at > NOW\(\) AND used_at IS NULL$/.test(s)) {
    return resetTokens
      .filter((t) => t.token === params[0] && t.expires_at > new Date() && !t.used_at)
      .map((t) => ({ user_id: t.user_id }));
  }
  if (/^UPDATE password_reset_tokens SET used_at = NOW\(\) WHERE token = \$1 AND expires_at > NOW\(\) AND used_at IS NULL RETURNING user_id$/.test(s)) {
    const t = resetTokens.find((r) => r.token === params[0] && r.expires_at > new Date() && !r.used_at);
    if (!t) return [];
    t.used_at = new Date();
    return [{ user_id: t.user_id }];
  }
  if (/^UPDATE password_reset_tokens SET used_at = NOW\(\) WHERE token = \$1$/.test(s)) {
    resetTokens.filter((r) => r.token === params[0]).forEach((r) => (r.used_at = new Date()));
    return [];
  }
  if (/^UPDATE password_reset_tokens SET used_at = NOW\(\) WHERE user_id = \$1 AND used_at IS NULL$/.test(s)) {
    resetTokens.filter((r) => r.user_id === params[0] && !r.used_at).forEach((r) => (r.used_at = new Date()));
    return [];
  }
  throw new Error(`Unexpected SQL in test: ${s}`);
}

// Yield between statements so concurrent requests interleave like real I/O.
async function query(sql: string, params?: unknown[]) {
  await new Promise((r) => setImmediate(r));
  return runQuery(sql, params);
}
const fakePool = {
  connect: async () => ({
    query: async (sql: string, params?: unknown[]) => ({ rows: await query(sql, params) }),
    release: () => {},
  }),
};
mock.module("@/lib/db", {
  defaultExport: fakePool,
  namedExports: {
    query,
    queryOne: async (sql: string, params?: unknown[]) => (await query(sql, params))[0] ?? null,
  },
});

// --- Route handlers --------------------------------------------------------
type Handler = (request: Request) => Promise<Response>;
let login: Handler;
let me: () => Promise<Response>;
let logout: () => Promise<Response>;
let resetPassword: Handler;

const COOKIE = "linkplanter_session";
let ipCounter = 0;

function json(url: string, body: unknown) {
  return new Request(`https://linkplanter.com${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ipCounter}` },
    body: JSON.stringify(body),
  });
}

async function loginAndGetToken(password = "old-password-123") {
  jar.clear();
  const res = await login(json("/api/auth/login", { email: "owner@example.com", password }));
  assert.equal(res.status, 200, "login should succeed");
  const token = jar.get(COOKIE);
  assert.ok(token, "login should set the session cookie");
  return token!;
}

async function meWith(token: string) {
  jar.set(COOKIE, token);
  return me();
}

describe("session revocation and reset tokens", () => {
  before(async () => {
    ({ POST: login } = await import("./login/route.ts"));
    ({ GET: me } = await import("./me/route.ts"));
    ({ POST: logout } = await import("./logout/route.ts"));
    ({ POST: resetPassword } = await import("./reset-password/route.ts"));
  });

  beforeEach(async () => {
    users.length = 0;
    resetTokens.length = 0;
    users.push({
      id: 7,
      email: "owner@example.com",
      password_hash: await bcrypt.hash("old-password-123", 4),
      email_verified_at: new Date(),
      subscription_status: "free",
      subscription_expires_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      session_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  test("a live session works", async () => {
    const token = await loginAndGetToken();
    const res = await meWith(token);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).user.id, 7);
  });

  test("a session token copied before logout is rejected after logout", async () => {
    const token = await loginAndGetToken();
    const out = await logout();
    assert.equal(out.status, 200);
    assert.equal(jar.has(COOKIE), false);

    const res = await meWith(token);
    assert.equal(res.status, 401, "pre-logout token must not authenticate");
  });

  test("a password reset revokes existing sessions", async () => {
    const token = await loginAndGetToken();
    resetTokens.push({ user_id: 7, token: "reset-a", expires_at: new Date(Date.now() + 3_600_000), used_at: null });

    const res = await resetPassword(json("/api/auth/reset-password", { token: "reset-a", password: "new-password-456" }));
    assert.equal(res.status, 200);

    assert.equal((await meWith(token)).status, 401, "pre-reset token must not authenticate");
    // The new password works and yields a working session.
    const fresh = await loginAndGetToken("new-password-456");
    assert.equal((await meWith(fresh)).status, 200);
  });

  test("a reset token can be consumed only once, even concurrently", async () => {
    resetTokens.push({ user_id: 7, token: "reset-b", expires_at: new Date(Date.now() + 3_600_000), used_at: null });

    const results = await Promise.all([
      resetPassword(json("/api/auth/reset-password", { token: "reset-b", password: "attacker-pass-1" })),
      resetPassword(json("/api/auth/reset-password", { token: "reset-b", password: "attacker-pass-2" })),
    ]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 400]);
  });

  test("an expired or used reset token is refused", async () => {
    resetTokens.push({ user_id: 7, token: "reset-old", expires_at: new Date(Date.now() - 1000), used_at: null });
    const res = await resetPassword(json("/api/auth/reset-password", { token: "reset-old", password: "new-password-456" }));
    assert.equal(res.status, 400);
    assert.equal(await bcrypt.compare("old-password-123", users[0].password_hash), true);
  });
});
