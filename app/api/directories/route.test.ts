import assert from "node:assert/strict";
import { before, beforeEach, describe, mock, test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-directories-do-not-use";

// Stubbed DB boundary. The directories query is answered from in-memory rows.
// The stub applies the premium entitlement only when the route's SQL asks for
// it through a users subquery bound to a parameter (`u.id = $n`), evaluated
// against the stored subscription row. The real SQL is exercised separately
// against Postgres; this test pins the route's contract.

type UserRow = {
  id: number;
  subscription_status: "free" | "paid" | "cancelled";
  subscription_expires_at: Date | null;
};

const users = new Map<number, UserRow>();
const directories = [
  { id: 1, name: "Free Dir", is_premium: false },
  { id: 2, name: "Premium Dir", is_premium: true },
];
const sqlLog: { sql: string; params: unknown[] }[] = [];

function entitled(u: UserRow | undefined): boolean {
  if (!u || u.subscription_status !== "paid") return false;
  return u.subscription_expires_at === null || u.subscription_expires_at.getTime() > Date.now();
}

async function query(sql: string, params: unknown[] = []) {
  sqlLog.push({ sql, params });
  if (/FROM directories d/.test(sql)) {
    let rows = directories.map((d) => ({ ...d, industries: [] }));
    if (/d\.is_premium = true/.test(sql)) rows = rows.filter((d) => d.is_premium);
    const m = sql.match(/u\.id = \$(\d+)/);
    if (m) {
      const u = users.get(Number(params[Number(m[1]) - 1]));
      if (!entitled(u)) rows = rows.filter((d) => !d.is_premium);
    }
    return rows;
  }
  if (/FROM industries/.test(sql)) return [];
  if (/COUNT\(\*\)/.test(sql)) return [{ total: 2, premium: 1, easy: 0, medium: 0, hard: 0 }];
  if (/FROM businesses/.test(sql)) return [];
  throw new Error(`Unexpected SQL in test: ${sql}`);
}

let sessionId = 0;
mock.module("@/lib/auth", {
  namedExports: {
    getSession: async () =>
      sessionId
        ? { id: sessionId, email: "u@example.com", subscription_status: "paid", email_verified: true }
        : null,
  },
});
mock.module("@/lib/db", {
  namedExports: { query, queryOne: async (s: string, p?: unknown[]) => (await query(s, p))[0] ?? null },
});

let GET: (request: Request) => Promise<Response>;

async function list(qs = "") {
  const res = await GET(new Request(`https://linkplanter.com/api/directories${qs}`));
  assert.equal(res.status, 200);
  const body = await res.json();
  return (body.directories as { name: string; is_premium: boolean }[]).map((d) => d.name).sort();
}

describe("GET /api/directories entitlement", () => {
  before(async () => {
    ({ GET } = await import("./route.ts"));
  });

  beforeEach(() => {
    users.clear();
    sqlLog.length = 0;
    users.set(1, { id: 1, subscription_status: "free", subscription_expires_at: null });
    users.set(2, { id: 2, subscription_status: "paid", subscription_expires_at: new Date(Date.now() + 86_400_000) });
    users.set(3, { id: 3, subscription_status: "paid", subscription_expires_at: new Date(Date.now() - 86_400_000) });
    users.set(4, { id: 4, subscription_status: "cancelled", subscription_expires_at: new Date(Date.now() + 86_400_000) });
  });

  test("unauthenticated is 401", async () => {
    sessionId = 0;
    const res = await GET(new Request("https://linkplanter.com/api/directories"));
    assert.equal(res.status, 401);
  });

  test("free account gets the free subset only, whatever the client filter says", async () => {
    sessionId = 1;
    assert.deepEqual(await list(), ["Free Dir"]);
    assert.deepEqual(await list("?premium=true"), []);
    assert.deepEqual(await list("?premium=all"), ["Free Dir"]);
  });

  test("entitlement comes from the user's row, not from the session claim", async () => {
    // The session stub claims "paid" for every user; only the DB row counts.
    sessionId = 3; // paid but expired
    assert.deepEqual(await list(), ["Free Dir"]);
    sessionId = 4; // cancelled
    assert.deepEqual(await list(), ["Free Dir"]);
  });

  test("current paid account gets premium directories", async () => {
    sessionId = 2;
    assert.deepEqual(await list(), ["Free Dir", "Premium Dir"]);
    assert.deepEqual(await list("?premium=true"), ["Premium Dir"]);
  });

  test("entitlement is bound to the session user id as a parameter", async () => {
    sessionId = 1;
    await list("?search=x&industry=y&difficulty=easy");
    const dirQuery = sqlLog.find((q) => /FROM directories d/.test(q.sql))!;
    const m = dirQuery.sql.match(/u\.id = \$(\d+)/);
    assert.ok(m, "directories SQL must check entitlement against users");
    assert.equal(dirQuery.params[Number(m[1]) - 1], 1);
  });
});
