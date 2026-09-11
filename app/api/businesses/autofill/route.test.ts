import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, mock, test } from "node:test";
import { promises as dns } from "dns";

process.env.AUTH_SECRET ??= "test-secret-autofill-ssrf-do-not-use";

const INTERNAL_HTML =
  "<html><title>INTERNAL_SECRET_BODY_DO_NOT_LEAK</title><h1>metadata</h1></html>";

type Session = {
  id: number;
  email: string;
  subscription_status: "free";
  email_verified: boolean;
} | null;

let session: Session = null;
const fetchCalls: { url: string; redirect?: RequestRedirect }[] = [];
const responses = new Map<string, () => Response>();

function publicSession(): Session {
  return {
    id: 1,
    email: "user@example.com",
    subscription_status: "free",
    email_verified: true,
  };
}

mock.module("@/lib/auth", {
  namedExports: {
    getSession: async () => session,
  },
});

let POST: (request: Request) => Promise<Response>;

function html(body: string, status = 200) {
  return () =>
    new Response(body, {
      status,
      headers: { "content-type": "text/html" },
    });
}

function redirectTo(location: string, status = 302) {
  return () =>
    new Response(null, {
      status,
      headers: { Location: location },
    });
}

async function mockedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const redirectMode = init?.redirect ?? "follow";
  let followed = 0;

  while (true) {
    fetchCalls.push({ url, redirect: init?.redirect });
    const factory = responses.get(url);
    if (!factory) {
      throw new Error(`Unexpected fetch (tests must not hit the network): ${url}`);
    }
    const res = factory();
    const location = res.headers.get("Location");
    const isRedirect = res.status >= 300 && res.status < 400 && location;
    if (isRedirect && redirectMode === "follow") {
      if (followed >= 20) {
        throw new TypeError("Failed to fetch");
      }
      followed += 1;
      url = new URL(location, url).href;
      continue;
    }
    return res;
  }
}

function post(url: string) {
  return POST(
    new Request("https://linkplanter.com/api/businesses/autofill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

async function assertNoInternalHtml(res: Response) {
  const raw = await res.clone().text();
  assert.equal(
    raw.includes("INTERNAL_SECRET_BODY_DO_NOT_LEAK"),
    false,
    "must not return internal HTML",
  );
  assert.equal(res.status, 400);
}

describe("POST /api/businesses/autofill", () => {
  before(async () => {
    ({ POST } = await import("./route.ts"));
  });

  beforeEach(() => {
    session = publicSession();
    fetchCalls.length = 0;
    responses.clear();
    mock.method(globalThis, "fetch", mockedFetch);
    mock.method(dns, "resolve4", async () => ["93.184.216.34"]);
    mock.method(dns, "resolve6", async () => {
      throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("unauthenticated POST returns 401", async () => {
    session = null;
    const res = await post("https://example.com");
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Not authenticated" });
    assert.equal(fetchCalls.length, 0);
  });

  test("DNS lookup failure is rejected (fail-closed)", async () => {
    mock.method(dns, "resolve4", () => {
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    });
    mock.method(dns, "resolve6", () => {
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    });

    const res = await post("https://dns-fail.example");
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Invalid URL" });
    assert.equal(fetchCalls.length, 0);
  });

  test("empty DNS resolution is rejected (fail-closed)", async () => {
    mock.method(dns, "resolve4", async () => []);
    mock.method(dns, "resolve6", async () => []);

    const res = await post("https://empty-dns.example");
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Invalid URL" });
    assert.equal(fetchCalls.length, 0);
  });

  test("302 to 127.0.0.1 does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://127.0.0.1/secret"));
    responses.set("http://127.0.0.1/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(
      fetchCalls.some((c) => c.url.includes("127.0.0.1")),
      false,
    );
  });

  test("302 to 127.1.1.1 does not fetch loopback", async () => {
    responses.set("https://example.com/", redirectTo("http://127.1.1.1/secret"));
    responses.set("http://127.1.1.1/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(
      fetchCalls.some((c) => c.url.includes("127.1.1.1")),
      false,
    );
  });

  test("302 to RFC1918 does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://192.168.1.50/admin"));
    responses.set("http://192.168.1.50/admin", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(
      fetchCalls.some((c) => c.url.includes("192.168.1.50")),
      false,
    );
  });

  test("302 to IPv6 loopback does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://[::1]/secret"));
    responses.set("http://[::1]/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(
      fetchCalls.some((c) => c.url.includes("::1") || c.url.includes("[::1]")),
      false,
    );
  });

  test("302 to 169.254.169.254 does not return internal HTML", async () => {
    responses.set(
      "https://example.com/",
      redirectTo("http://169.254.169.254/latest/meta-data/"),
    );
    responses.set("http://169.254.169.254/latest/meta-data/", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(
      fetchCalls.some((c) => c.url.includes("169.254.169.254")),
      false,
    );
  });
});
