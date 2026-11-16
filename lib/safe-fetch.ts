import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { promises as dns } from "node:dns";
import { addAbortSignal, pipeline, type Readable } from "node:stream";
import zlib from "node:zlib";

// Outbound fetch for user-supplied URLs (SSRF-safe).
//
// Each hop resolves the hostname once, rejects it if ANY address is not
// public, and then connects to that same validated address through a pinned
// `lookup`. The hostname is kept on the request, so TLS SNI, certificate
// checks and the Host header still use it. A second DNS answer (rebinding)
// is never consulted. Redirects are followed by hand, re-validated per hop,
// and capped. The body is capped in bytes and must be HTML.

export class SafeFetchError extends Error {
  constructor(public reason: "blocked" | "status" | "content-type" | "network") {
    super(reason);
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
// No ::ffff:0:0/96 rule: BlockList already applies the IPv4 rules above to
// IPv4-mapped IPv6 addresses, and such a rule would match every IPv4 address.
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10],
  ["fec0::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) return !blocked.check(ip, "ipv6");
  return false;
}

type Target = { address: string; family: 4 | 6 };

async function resolvePublicTarget(url: URL): Promise<Target> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("blocked");
  if (url.username || url.password) throw new SafeFetchError("blocked");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // WHATWG URL parsing already normalises decimal/hex/octal IPv4 forms.
  const literal = isIP(host);
  if (literal) {
    if (!isPublicAddress(host)) throw new SafeFetchError("blocked");
    return { address: host, family: literal as 4 | 6 };
  }
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) {
    throw new SafeFetchError("blocked");
  }

  const [v4, v6] = await Promise.allSettled([
    (async () => dns.resolve4(host))(),
    (async () => dns.resolve6(host))(),
  ]);
  const a = v4.status === "fulfilled" ? v4.value : [];
  const aaaa = v6.status === "fulfilled" ? v6.value : [];
  // Fail closed: nothing resolved, or any answer is non-public.
  if (a.length + aaaa.length === 0) throw new SafeFetchError("blocked");
  if (![...a, ...aaaa].every(isPublicAddress)) throw new SafeFetchError("blocked");
  return a.length ? { address: a[0], family: 4 } : { address: aaaa[0], family: 6 };
}

function requestPinned(
  url: URL,
  target: Target,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<http.IncomingMessage> {
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: "GET",
        headers,
        signal,
        agent: false, // fresh socket per hop; never reuse a pooled connection
        lookup: ((_host: string, opts: { all?: boolean } | undefined, cb: (...args: unknown[]) => void) => {
          if (opts?.all) cb(null, [{ address: target.address, family: target.family }]);
          else cb(null, target.address, target.family);
        }) as never,
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

function decoderFor(encoding: string): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
  if (encoding === "gzip" || encoding === "x-gzip") return zlib.createGunzip();
  if (encoding === "deflate") return zlib.createInflate();
  if (encoding === "br") return zlib.createBrotliDecompress();
  if (encoding === "identity") return null;
  throw new SafeFetchError("content-type");
}

async function readCapped(
  res: http.IncomingMessage,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const encoding = String(res.headers["content-encoding"] ?? "identity").toLowerCase();
  let decoder: ReturnType<typeof decoderFor>;
  try {
    decoder = decoderFor(encoding);
  } catch (err) {
    res.destroy();
    throw err;
  }
  // pipeline (not pipe) propagates errors and destruction both ways, so a
  // failed or aborted response also ends the decompressor, and vice versa.
  const stream: Readable = decoder ? pipeline(res, decoder, () => {}) : res;
  // The overall deadline covers the body: a stall after headers is aborted.
  addAbortSignal(signal, stream);

  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of stream) {
      // Counts decompressed bytes, so a small compressed bomb hits the cap.
      const buf = chunk as Buffer;
      const room = maxBytes - total;
      chunks.push(buf.length > room ? buf.subarray(0, room) : buf);
      total += Math.min(buf.length, room);
      if (total >= maxBytes) break; // cap reached: parse what we have
    }
  } catch {
    throw new SafeFetchError("network"); // reset, bad encoding, or deadline
  } finally {
    stream.destroy();
    decoder?.destroy();
    res.destroy();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function safeFetchHtml(
  input: string,
  opts: { headers: Record<string, string>; maxRedirects: number; maxBytes: number; timeoutMs: number },
): Promise<{ url: string; html: string }> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let url = new URL(input);
  for (let hop = 0; ; hop++) {
    const target = await resolvePublicTarget(url);
    const res = await requestPinned(url, target, opts.headers, signal);
    const status = res.statusCode ?? 0;

    if (status >= 300 && status < 400) {
      res.destroy();
      const location = res.headers.location;
      if (!location || hop >= opts.maxRedirects) throw new SafeFetchError("blocked");
      try {
        url = new URL(location, url);
      } catch {
        throw new SafeFetchError("blocked");
      }
      continue;
    }
    if (status < 200 || status >= 300) {
      res.destroy();
      throw new SafeFetchError("status");
    }
    const type = String(res.headers["content-type"] ?? "").toLowerCase();
    if (!/^\s*(text\/html|application\/xhtml\+xml)\b/.test(type)) {
      res.destroy();
      throw new SafeFetchError("content-type");
    }
    return { url: url.href, html: await readCapped(res, opts.maxBytes, signal) };
  }
}
