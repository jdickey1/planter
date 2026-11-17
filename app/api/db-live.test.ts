import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, mock, test, type TestContext } from "node:test";
import { Client } from "pg";

// Runs the real SQL (premium gating, session_version check, reset lock order)
// against Postgres. The other tests stub the DB and cannot catch SQL edits.
//
// Needs a Postgres role that may CREATE DATABASE. Connection: the
// PLANTER_TEST_PG_URL URL if set, else the libpq PG* env defaults (PGHOST may
// be a socket dir). The test creates a throwaway database, runs there, and
// drops it; it never reads DATABASE_URL and never touches an existing
// database. With no reachable server it skips with a message.

process.env.AUTH_SECRET ??= "test-secret-db-live-do-not-use";

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

const COOKIE = "linkplanter_session";
const adminUrl = process.env.PLANTER_TEST_PG_URL;
const dbName = `planter_test_${process.pid}_${Date.now()}`;
let skipReason: string | null = null;
let admin: Client | null = null;

type Auth = typeof import("@/lib/auth");
type Db = typeof import("@/lib/db");
let auth: Auth;
let db: Db;
let directoriesGET: (request: Request) => Promise<Response>;
let logoutPOST: () => Promise<Response>;

// Minimal slice of the production schema: only the columns this code reads.
// session_version comes from the real migration file below.
const SCHEMA = `
  CREATE TABLE users (
    id serial PRIMARY KEY,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    email_verified_at timestamptz,
    subscription_status text NOT NULL DEFAULT 'free',
    subscription_expires_at timestamptz,
    stripe_customer_id text,
    stripe_subscription_id text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );
  CREATE TABLE directories (
    id serial PRIMARY KEY,
    name text NOT NULL, slug text NOT NULL, url text NOT NULL,
    da_score int, dr_score int,
    difficulty text NOT NULL DEFAULT 'easy', submission_type text NOT NULL DEFAULT 'form',
    avg_approval_days int, is_free boolean NOT NULL DEFAULT true,
    is_premium boolean NOT NULL DEFAULT false, instructions text, submission_url text,
    anchor_text_field text NOT NULL DEFAULT 'name', is_active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE industries (id serial PRIMARY KEY, slug text NOT NULL, name text NOT NULL);
  CREATE TABLE directory_industries (directory_id int NOT NULL, industry_id int NOT NULL);
  CREATE TABLE businesses (user_id int NOT NULL, target_anchor_text text, secondary_anchor_texts text[]);
  CREATE TABLE password_reset_tokens (
    id serial PRIMARY KEY,
    user_id int NOT NULL REFERENCES users(id),
    token text UNIQUE NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz
  );
`;
const MIGRATION = readFileSync(
  path.join(process.cwd(), "sql/2026-11-16-users-session-version.sql"),
  "utf8",
);

function needDb(t: TestContext): boolean {
  if (skipReason) t.skip(skipReason);
  return !skipReason;
}

async function addUser(email: string, status: string, expiresSql: string): Promise<number> {
  const r = await db.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, subscription_status, subscription_expires_at)
     VALUES ($1, 'x', $2, ${expiresSql}) RETURNING id`,
    [email, status],
  );
  return r[0].id;
}

async function tokenFor(id: number): Promise<string> {
  const u = await db.queryOne<{ id: number; session_version: number }>(
    "SELECT id, session_version FROM users WHERE id = $1",
    [id],
  );
  return auth.createSessionToken(u!);
}

async function directoryNames(id: number, qs = ""): Promise<string[]> {
  jar.set(COOKIE, await tokenFor(id));
  const res = await directoriesGET(new Request(`https://linkplanter.com/api/directories${qs}`));
  assert.equal(res.status, 200);
  const body = await res.json();
  return (body.directories as { name: string }[]).map((d) => d.name).sort();
}

describe("live Postgres: entitlement, session revocation, reset locking", () => {
  before(async () => {
    try {
      admin = new Client(
        adminUrl
          ? { connectionString: adminUrl, connectionTimeoutMillis: 3000 }
          : { database: "postgres", connectionTimeoutMillis: 3000 },
      );
      await admin.connect();
      await admin.query(`CREATE DATABASE ${dbName}`);
    } catch (err) {
      skipReason = `no usable Postgres (set PLANTER_TEST_PG_URL or PGHOST/PGUSER; role needs CREATEDB): ${
        (err as Error).message
      }`;
      console.log(`# db-live: SKIPPED, ${skipReason}`);
      await admin?.end().catch(() => {});
      admin = null;
      return;
    }
    // Point the app pool (lib/db) at the throwaway database only.
    if (adminUrl) {
      const u = new URL(adminUrl);
      u.pathname = `/${dbName}`;
      process.env.DATABASE_URL = u.href;
    } else {
      delete process.env.DATABASE_URL;
      process.env.PGDATABASE = dbName;
    }
    db = await import("@/lib/db");
    auth = await import("@/lib/auth");
    ({ GET: directoriesGET } = await import("./directories/route.ts"));
    ({ POST: logoutPOST } = await import("./auth/logout/route.ts"));

    await db.query(SCHEMA);
    await db.query(MIGRATION);
    await db.query(MIGRATION); // idempotent
    await db.query(
      `INSERT INTO directories (name, slug, url, is_premium) VALUES
         ('Free Dir', 'free', 'https://free.example', false),
         ('Premium Dir', 'premium', 'https://premium.example', true)`,
    );
  });

  after(async () => {
    if (!admin) return;
    await db?.default.end().catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => {});
    await admin.end();
  });

  test("premium directories follow the users row: free, expired, cancelled, paid", async (t) => {
    if (!needDb(t)) return;
    const free = await addUser("free@example.com", "free", "NULL");
    const expired = await addUser("expired@example.com", "paid", "NOW() - interval '1 day'");
    const cancelled = await addUser("cancelled@example.com", "cancelled", "NOW() + interval '1 day'");
    const paid = await addUser("paid@example.com", "paid", "NOW() + interval '1 day'");
    const paidOpen = await addUser("paid-open@example.com", "paid", "NULL");

    for (const id of [free, expired, cancelled]) {
      assert.deepEqual(await directoryNames(id), ["Free Dir"]);
      assert.deepEqual(await directoryNames(id, "?premium=true"), []);
    }
    for (const id of [paid, paidOpen]) {
      assert.deepEqual(await directoryNames(id), ["Free Dir", "Premium Dir"]);
    }
  });

  test("session_version: logout revokes a copied token", async (t) => {
    if (!needDb(t)) return;
    const id = await addUser("logout@example.com", "free", "NULL");
    const token = await tokenFor(id);
    jar.set(COOKIE, token);
    assert.equal((await auth.getSession())?.id, id);

    assert.equal((await logoutPOST()).status, 200);
    assert.equal(jar.has(COOKIE), false);
    jar.set(COOKIE, token); // the copied cookie
    assert.equal(await auth.getSession(), null);
  });

  test("two valid reset tokens for one user at once: one wins, no deadlock", async (t) => {
    if (!needDb(t)) return;
    const id = await addUser("reset@example.com", "free", "NULL");
    const before = await tokenFor(id);
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES
         ($1, 'live-r1', NOW() + interval '1 hour'), ($1, 'live-r2', NOW() + interval '1 hour')`,
      [id],
    );
    // Hold the user row from a third connection until both resets are blocked
    // on a lock, so their transactions overlap for certain (bcrypt timing
    // would otherwise run them one after the other). With the wrong lock
    // order each reset claims its own token row first and Postgres reports a
    // deadlock when the holder lets go.
    const holder = new Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    let results: (number | null)[];
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [id]);
      const pending = Promise.all([
        auth.resetPasswordWithToken("live-r1", "new-password-r1"),
        auth.resetPasswordWithToken("live-r2", "new-password-r2"),
      ]);
      pending.catch(() => {}); // surfaced by the await below
      // Poll from the admin connection: inside the holder's transaction
      // pg_stat_activity is a frozen snapshot.
      for (const deadline = Date.now() + 60_000; ; ) {
        const w = await admin!.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_stat_activity
           WHERE datname = $1 AND wait_event_type = 'Lock'`,
          [dbName],
        );
        if (w.rows[0].n >= 2) break;
        assert.ok(Date.now() < deadline, "both resets should block on the held user row");
        await new Promise((r) => setTimeout(r, 20));
      }
      await holder.query("COMMIT");
      results = await pending;
    } finally {
      await holder.query("ROLLBACK").catch(() => {});
      await holder.end();
    }
    assert.deepEqual(results.map((r) => r === id).sort(), [false, true], `results: ${results}`);

    const left = await db.query("SELECT 1 FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL", [id]);
    assert.equal(left.length, 0, "every outstanding token is burned");
    const u = await db.queryOne<{ session_version: number }>("SELECT session_version FROM users WHERE id = $1", [id]);
    assert.equal(u!.session_version, 1, "exactly one reset committed");
    jar.set(COOKIE, before);
    assert.equal(await auth.getSession(), null, "pre-reset session revoked");
  });

  test("the same reset token submitted twice at once is consumed once", async (t) => {
    if (!needDb(t)) return;
    const id = await addUser("reset-same@example.com", "free", "NULL");
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, 'live-s1', NOW() + interval '1 hour')`,
      [id],
    );
    const results = await Promise.all([
      auth.resetPasswordWithToken("live-s1", "new-password-s1"),
      auth.resetPasswordWithToken("live-s1", "new-password-s2"),
    ]);
    assert.deepEqual(results.map((r) => r === id).sort(), [false, true], `results: ${results}`);
  });
});
