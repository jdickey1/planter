import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, mock, test } from "node:test";
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import zlib from "node:zlib";
import { promises as dns } from "dns";

process.env.AUTH_SECRET ??= "test-secret-autofill-ssrf-do-not-use";

const INTERNAL_HTML =
  "<html><title>INTERNAL_SECRET_BODY_DO_NOT_LEAK</title><h1>metadata</h1></html>";
const PUBLIC_IP = "93.184.216.34";

type Session = {
  id: number;
  email: string;
  subscription_status: "free";
  email_verified: boolean;
} | null;

let session: Session = null;
let nextUserId = 1;

function publicSession(): Session {
  // A fresh account per test so the per-account limits do not leak between tests.
  return {
    id: nextUserId++,
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
let safeFetchHtml: typeof import("@/lib/safe-fetch").safeFetchHtml;
let isPublicAddress: typeof import("@/lib/safe-fetch").isPublicAddress;
let SafeFetchError: typeof import("@/lib/safe-fetch").SafeFetchError;

// ---------------------------------------------------------------------------
// Simulated network. Nothing in these tests touches the real network.
//
// A connection goes to an IP address. For a hostname, the address comes from
// the connect-time resolver: the caller-supplied `lookup` when the code pins
// one, otherwise `connectTimeDns` (what getaddrinfo would return when the
// socket opens). A response is chosen by the IP first (`ipResponses`), then by
// the URL (`responses`).
// ---------------------------------------------------------------------------

type FakeResponse = {
  status: number;
  headers: Record<string, string>;
  body: () => Readable;
};
type Factory = () => FakeResponse | Promise<FakeResponse>;

const responses = new Map<string, Factory>();
const ipResponses = new Map<string, Factory>();
const connections: { url: string; ip: string }[] = [];
let connectTimeDns: (host: string) => string = () => PUBLIC_IP;

function html(body: string, status = 200, contentType = "text/html; charset=utf-8"): Factory {
  return () => ({
    status,
    headers: { "content-type": contentType },
    body: () => Readable.from([Buffer.from(body)]),
  });
}

function redirectTo(location: string, status = 302): Factory {
  return () => ({ status, headers: { location }, body: () => Readable.from([]) });
}

async function connect(
  url: URL,
  lookup?: (host: string, opts: object, cb: (...args: unknown[]) => void) => void,
): Promise<FakeResponse> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let ip: string;
  if (isIP(host)) {
    ip = host;
  } else if (lookup) {
    ip = await new Promise<string>((resolve, reject) =>
      lookup(host, {}, (err, address) => (err ? reject(err) : resolve(address as string))),
    );
  } else {
    ip = connectTimeDns(host);
  }
  connections.push({ url: url.href, ip });
  const factory = ipResponses.get(ip) ?? responses.get(url.href);
  if (!factory) {
    throw new Error(`Unexpected connection (tests must not hit the network): ${url.href} -> ${ip}`);
  }
  return factory();
}

// Global fetch through the simulated network (no address pinning possible).
async function mockedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  for (let followed = 0; ; followed++) {
    const res = await connect(url);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location && init?.redirect !== "manual") {
      if (followed >= 20) throw new TypeError("Failed to fetch");
      url = new URL(location, url);
      continue;
    }
    const body = res.status === 204 || (res.status >= 300 && res.status < 400)
      ? null
      : (Readable.toWeb(res.body()) as ReadableStream);
    return new Response(body, { status: res.status, headers: res.headers });
  }
}

// node:http / node:https request through the simulated network.
function mockedRequest(...args: unknown[]) {
  const [first, second, third] = args;
  const url = new URL(first instanceof URL ? first.href : String(first));
  const options = (typeof second === "object" && second !== null ? second : {}) as {
    lookup?: (host: string, opts: object, cb: (...a: unknown[]) => void) => void;
  };
  const cb = (typeof second === "function" ? second : third) as
    | ((res: http.IncomingMessage) => void)
    | undefined;

  const req = new EventEmitter() as EventEmitter & {
    end: () => void;
    destroy: () => void;
    setTimeout: () => void;
  };
  req.setTimeout = () => {};
  req.destroy = () => {};
  req.end = () => {
    connect(url, options.lookup).then(
      (fake) => {
        const res = fake.body() as Readable & {
          statusCode?: number;
          headers?: Record<string, string>;
        };
        res.statusCode = fake.status;
        res.headers = fake.headers;
        req.emit("response", res);
        cb?.(res as unknown as http.IncomingMessage);
      },
      (err) => req.emit("error", err),
    );
  };
  return req;
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

async function assertNoInternalHtml(res: Response, status = 400) {
  const raw = await res.clone().text();
  assert.equal(
    raw.includes("INTERNAL_SECRET_BODY_DO_NOT_LEAK"),
    false,
    "must not return internal HTML",
  );
  assert.equal(res.status, status);
}

describe("POST /api/businesses/autofill", () => {
  before(async () => {
    ({ POST } = await import("./route.ts"));
    ({ safeFetchHtml, SafeFetchError, isPublicAddress } = await import("@/lib/safe-fetch"));
  });

  beforeEach(() => {
    session = publicSession();
    connections.length = 0;
    responses.clear();
    ipResponses.clear();
    connectTimeDns = () => PUBLIC_IP;
    mock.method(globalThis, "fetch", mockedFetch);
    mock.method(http, "request", mockedRequest);
    mock.method(https, "request", mockedRequest);
    mock.method(dns, "resolve4", async () => [PUBLIC_IP]);
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
    assert.equal(connections.length, 0);
  });

  test("public page is fetched and parsed", async () => {
    responses.set("https://example.com/", html("<html><title>Acme Co</title><h1>Acme</h1></html>"));
    const res = await post("https://example.com/");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.name, "Acme Co");
    assert.deepEqual(connections, [{ url: "https://example.com/", ip: PUBLIC_IP }]);
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
    assert.equal(connections.length, 0);
  });

  test("empty DNS resolution is rejected (fail-closed)", async () => {
    mock.method(dns, "resolve4", async () => []);
    mock.method(dns, "resolve6", async () => []);

    const res = await post("https://empty-dns.example");
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Invalid URL" });
    assert.equal(connections.length, 0);
  });

  test("hostname resolving to any private address is rejected", async () => {
    mock.method(dns, "resolve4", async () => [PUBLIC_IP, "10.0.0.5"]);
    const res = await post("https://mixed.example");
    assert.equal(res.status, 400);
    assert.equal(connections.length, 0);
  });

  test("DNS rebinding: public at check time, private at connect time, never reaches the private host", async () => {
    // The validation lookup answers with a public address; a second lookup at
    // connect time answers with loopback (TTL 0 rebinding).
    connectTimeDns = () => "127.0.0.1";
    ipResponses.set("127.0.0.1", html(INTERNAL_HTML));
    responses.set("http://rebind.example/", html("<html><title>Public Page</title></html>"));

    const res = await post("http://rebind.example/");
    await assertNoInternalHtml(res, 200);
    assert.equal(connections.some((c) => c.ip === "127.0.0.1"), false, "connected to loopback");
    assert.deepEqual(connections.map((c) => c.ip), [PUBLIC_IP]);
  });

  test("DNS rebinding on a redirect hop is pinned too", async () => {
    connectTimeDns = (host) => (host === "hop2.example" ? "169.254.169.254" : PUBLIC_IP);
    ipResponses.set("169.254.169.254", html(INTERNAL_HTML));
    responses.set("https://example.com/", redirectTo("https://hop2.example/x"));
    responses.set("https://hop2.example/x", html("<html><title>Hop Two</title></html>"));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res, 200);
    assert.deepEqual(connections.map((c) => c.ip), [PUBLIC_IP, PUBLIC_IP]);
  });

  test("302 to 127.0.0.1 does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://127.0.0.1/secret"));
    responses.set("http://127.0.0.1/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(connections.some((c) => c.url.includes("127.0.0.1")), false);
  });

  test("302 to 127.1.1.1 does not fetch loopback", async () => {
    responses.set("https://example.com/", redirectTo("http://127.1.1.1/secret"));
    responses.set("http://127.1.1.1/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(connections.some((c) => c.url.includes("127.1.1.1")), false);
  });

  test("302 to RFC1918 does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://192.168.1.50/admin"));
    responses.set("http://192.168.1.50/admin", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(connections.some((c) => c.url.includes("192.168.1.50")), false);
  });

  test("302 to IPv6 loopback does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://[::1]/secret"));
    responses.set("http://[::1]/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(connections.some((c) => c.url.includes("[::1]")), false);
  });

  test("302 to IPv4-mapped IPv6 loopback does not return internal HTML", async () => {
    responses.set("https://example.com/", redirectTo("http://[::ffff:7f00:1]/secret"));
    responses.set("http://[::ffff:7f00:1]/secret", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(connections.length, 1);
  });

  test("302 to 169.254.169.254 does not return internal HTML", async () => {
    responses.set(
      "https://example.com/",
      redirectTo("http://169.254.169.254/latest/meta-data/"),
    );
    responses.set("http://169.254.169.254/latest/meta-data/", html(INTERNAL_HTML));

    const res = await post("https://example.com/");
    await assertNoInternalHtml(res);
    assert.equal(connections.some((c) => c.url.includes("169.254.169.254")), false);
  });

  test("redirect chains longer than the hop cap are refused", async () => {
    for (let i = 0; i < 6; i++) {
      responses.set(`https://example.com/${i}`, redirectTo(`https://example.com/${i + 1}`));
    }
    responses.set("https://example.com/6", html("<html><title>End</title></html>"));
    const res = await post("https://example.com/0");
    assert.equal(res.status, 400);
    assert.ok(connections.length <= 4, `followed ${connections.length} hops`);
  });

  test("non-HTML content types are refused", async () => {
    responses.set("https://example.com/", html("<html><title>x</title></html>", 200, "image/png"));
    const res = await post("https://example.com/");
    assert.equal(res.status, 400);
  });

  test("response body is capped instead of read without bound", { timeout: 5000 }, async () => {
    // An endless text/html body: an unbounded reader never finishes.
    responses.set("https://example.com/", () => ({
      status: 200,
      headers: { "content-type": "text/html" },
      body: () =>
        Readable.from(
          (async function* () {
            yield Buffer.from("<html><head><title>Big Page</title></head><body>");
            const pad = Buffer.alloc(64 * 1024, "a");
            while (true) {
              await new Promise((r) => setImmediate(r)); // keep the event loop (and timeouts) alive
              yield pad;
            }
          })(),
        ),
    }));
    const res = await post("https://example.com/");
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.name, "Big Page");
  });

  // Compressed bodies: errors, stalls and the deadline must reach the reader
  // through the decompressor, and the cap counts decompressed bytes.
  const fetchOpts = (timeoutMs: number, maxBytes = 2 * 1024 * 1024) => ({
    headers: {}, maxRedirects: 3, maxBytes, timeoutMs,
  });
  const gzipHeaders = { "content-type": "text/html", "content-encoding": "gzip" };
  const isNetworkError = (err: unknown) =>
    err instanceof SafeFetchError && err.reason === "network";

  test("gzip body that stalls after the first chunk is aborted at the deadline", { timeout: 5000 }, async () => {
    const gz = zlib.gzipSync(Buffer.from("<html><title>Stall</title>" + "x".repeat(10_000)));
    let destroyed = false;
    responses.set("https://example.com/", () => ({
      status: 200,
      headers: gzipHeaders,
      body: () => {
        // First half arrives, then the socket goes silent forever.
        const r = new Readable({ read() {} });
        r.push(gz.subarray(0, gz.length >> 1));
        r.on("close", () => (destroyed = true));
        return r;
      },
    }));
    const started = Date.now();
    await assert.rejects(safeFetchHtml("https://example.com/", fetchOpts(200)), isNetworkError);
    assert.ok(Date.now() - started < 2000, "aborted near the deadline");
    assert.equal(destroyed, true, "response destroyed");
  });

  test("gzip body whose response errors mid-stream rejects promptly", { timeout: 5000 }, async () => {
    const gz = zlib.gzipSync(Buffer.from("<html><title>Broken</title>" + "x".repeat(10_000)));
    responses.set("https://example.com/", () => ({
      status: 200,
      headers: gzipHeaders,
      body: () => {
        const r = new Readable({ read() {} });
        r.push(gz.subarray(0, gz.length >> 1));
        setTimeout(() => r.destroy(new Error("ECONNRESET")), 20);
        return r;
      },
    }));
    const started = Date.now();
    await assert.rejects(safeFetchHtml("https://example.com/", fetchOpts(3000)), isNetworkError);
    assert.ok(Date.now() - started < 1000, "rejected before the deadline");
  });

  test("gzip bomb stops at the decompressed byte cap", { timeout: 5000 }, async () => {
    // ~200 KB compressed, 200 MB decompressed.
    const bomb = zlib.gzipSync(Buffer.alloc(200 * 1024 * 1024, 0x61), { level: 9 });
    assert.ok(bomb.length < 512 * 1024);
    let sourceDestroyed = false;
    responses.set("https://example.com/", () => ({
      status: 200,
      headers: gzipHeaders,
      body: () => {
        const r = Readable.from([Buffer.from(bomb)]);
        r.on("close", () => (sourceDestroyed = true));
        return r;
      },
    }));
    const cap = 1024 * 1024;
    const { html: body } = await safeFetchHtml("https://example.com/", fetchOpts(3000, cap));
    assert.equal(Buffer.byteLength(body), cap);
    await new Promise((r) => setImmediate(r));
    assert.equal(sourceDestroyed, true, "source released after the cap");
  });

  test("connection-level errors (refused, TLS, timeout) are a 400, not a 500", async () => {
    const failures = [
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      Object.assign(new Error("certificate has expired"), { code: "CERT_HAS_EXPIRED" }),
      Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError", code: 23 }),
    ];
    for (const failure of failures) {
      ipResponses.set(PUBLIC_IP, () => {
        throw failure;
      });
      await assert.rejects(safeFetchHtml("https://example.com/", fetchOpts(3000)), isNetworkError);
      const res = await post("https://example.com/");
      assert.equal(res.status, 400, `${failure.message} should be a 400`);
      assert.deepEqual(await res.json(), { error: "Could not fetch website" });
    }
  });

  test("IPv4-compatible and SIIT IPv6 forms of internal addresses are not public", () => {
    for (const ip of ["::127.0.0.1", "::7f00:1", "::a00:1", "::ffff:0:7f00:1", "::ffff:0:a9fe:a9fe"]) {
      assert.equal(isPublicAddress(ip), false, `${ip} must be blocked`);
    }
    for (const ip of ["8.8.8.8", "::ffff:8.8.8.8", "2606:4700:4700::1111"]) {
      assert.equal(isPublicAddress(ip), true, `${ip} must stay public`);
    }
  });

  test("per-account rate limit returns 429", async () => {
    mock.method(dns, "resolve4", async () => []);
    mock.method(dns, "resolve6", async () => []);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await post("https://nx.example")).status);
    assert.equal(statuses.includes(429), true, `statuses: ${statuses.join(",")}`);
    assert.equal(statuses[0], 400);
  });

  test("per-account concurrency limit returns 429 while requests are in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    responses.set("https://slow.example/", async () => {
      await gate;
      return html("<html><title>Slow</title></html>")();
    });
    const inflight = [post("https://slow.example/"), post("https://slow.example/"), post("https://slow.example/")];
    // Let the first requests reach the transport before releasing it.
    await new Promise((r) => setTimeout(r, 50));
    release();
    const statuses = (await Promise.all(inflight)).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 200, 429]);
  });
});
