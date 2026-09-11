import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import * as cheerio from "cheerio";
import { promises as dns } from "dns";

function isPrivateIp(ip: string): boolean {
  // Strip IPv6 brackets if present
  const addr = ip.replace(/^\[|\]$/g, "");

  // --- IPv4 checks ---
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    if (addr === "0.0.0.0") return true;
    if (addr.startsWith("127.")) return true;
    if (addr.startsWith("10.")) return true;
    if (addr.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(addr)) return true;
    if (addr.startsWith("169.254.")) return true; // link-local / cloud metadata
    if (addr.startsWith("100.64.") || addr.startsWith("100.65.") ||
        addr.startsWith("100.66.") || addr.startsWith("100.67.") ||
        addr.startsWith("100.68.") || addr.startsWith("100.69.") ||
        addr.startsWith("100.70.") || addr.startsWith("100.71.") ||
        addr.startsWith("100.72.") || addr.startsWith("100.73.") ||
        addr.startsWith("100.74.") || addr.startsWith("100.75.") ||
        addr.startsWith("100.76.") || addr.startsWith("100.77.") ||
        addr.startsWith("100.78.") || addr.startsWith("100.79.") ||
        addr.startsWith("100.80.") || addr.startsWith("100.81.") ||
        addr.startsWith("100.82.") || addr.startsWith("100.83.") ||
        addr.startsWith("100.84.") || addr.startsWith("100.85.") ||
        addr.startsWith("100.86.") || addr.startsWith("100.87.") ||
        addr.startsWith("100.88.") || addr.startsWith("100.89.") ||
        addr.startsWith("100.90.") || addr.startsWith("100.91.") ||
        addr.startsWith("100.92.") || addr.startsWith("100.93.") ||
        addr.startsWith("100.94.") || addr.startsWith("100.95.") ||
        addr.startsWith("100.96.") || addr.startsWith("100.97.") ||
        addr.startsWith("100.98.") || addr.startsWith("100.99.") ||
        addr.startsWith("100.10") || addr.startsWith("100.11") ||
        addr.startsWith("100.12") || addr.startsWith("100.127.")) return true; // CGNAT
    if (addr.startsWith("198.18.") || addr.startsWith("198.19.")) return true; // benchmark
    if (addr.startsWith("240.") || addr.startsWith("255.")) return true; // reserved
    return false;
  }

  // --- IPv6 checks ---
  const lower = addr.toLowerCase();

  // Loopback ::1
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;

  // Unspecified ::
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;

  // IPv4-mapped/compatible ::ffff:x.x.x.x
  if (lower.startsWith("::ffff:")) return true;

  // Link-local fe80::/10
  if (lower.startsWith("fe80:") || lower.startsWith("fe9") ||
      lower.startsWith("fea") || lower.startsWith("feb")) return true;

  // Site-local (deprecated) fec0::/10
  if (lower.startsWith("fec") || lower.startsWith("fed") ||
      lower.startsWith("fee") || lower.startsWith("fef")) return true;

  // ULA fc00::/7 (fc00:: and fd00::)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

  // IPv6 cloud metadata (AWS uses fd00:ec2::254, GCP uses similar)
  if (lower.startsWith("fd00:ec2:") || lower.startsWith("fd00:")) return true;

  // Multicast ff00::/8
  if (lower.startsWith("ff")) return true;

  return false;
}

async function isAllowedUrlWithDnsCheck(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

    // Block localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;

    // Block IPv6 loopback and mapped addresses (hostname-level check)
    if (hostname === "::1" || hostname === "::ffff:127.0.0.1" || hostname.startsWith("::ffff:")) return false;
    if (hostname === "0:0:0:0:0:0:0:1") return false;

    // Block 0.0.0.0/8 range (all zeroes prefix)
    if (/^0\./.test(hostname)) return false;

    // Block RFC1918 private ranges (hostname-level)
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return false;

    // Block link-local / cloud metadata IP (hostname-level)
    if (hostname.startsWith("169.254.")) return false;

    // Block IPv6 link-local, ULA, and private ranges at hostname level
    const lowerHost = hostname.toLowerCase();
    if (lowerHost.startsWith("fe80:") || lowerHost.startsWith("fc") ||
        lowerHost.startsWith("fd") || lowerHost.startsWith("ff")) return false;

    // Block short-form IP tricks (hex, octal, decimal integer)
    if (/^\d+$/.test(hostname)) return false;         // decimal integer like 2130706433
    if (/^0x[0-9a-f]+$/i.test(hostname)) return false; // hex 0x7f000001
    if (/^0[0-7]/.test(hostname)) return false;        // octal 0177.0.0.1

    // Block internal/local TLDs
    if (hostname.endsWith(".internal") || hostname.endsWith(".local")) return false;
    if (hostname.endsWith(".localhost")) return false;

    // DNS rebinding protection: resolve hostname and verify resolved IPs are public
    // Skip DNS check for literal IPs (already validated above)
    if (!/^[\d.]+$/.test(hostname) && !hostname.includes(":")) {
      try {
        const [ipv4Results, ipv6Results] = await Promise.allSettled([
          dns.resolve4(hostname),
          dns.resolve6(hostname),
        ]);

        const resolvedIps: string[] = [];
        if (ipv4Results.status === "fulfilled") resolvedIps.push(...ipv4Results.value);
        if (ipv6Results.status === "fulfilled") resolvedIps.push(...ipv6Results.value);

        // If we can't resolve at all, fail closed
        if (resolvedIps.length === 0) return false;

        // Reject if ANY resolved IP is private/internal
        for (const ip of resolvedIps) {
          if (isPrivateIp(ip)) return false;
        }
      } catch {
        // DNS lookup failed entirely — fail closed
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}


export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    // Validate URL to prevent SSRF (includes DNS rebinding check)
    if (!(await isAllowedUrlWithDnsCheck(normalizedUrl))) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (compatible; LinkPlanter/1.0; +https://linkplanter.com)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    const MAX_REDIRECTS = 3;
    let currentUrl = normalizedUrl;
    let response = await fetch(currentUrl, {
      headers: fetchHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    for (
      let hop = 0;
      hop < MAX_REDIRECTS && response.status >= 300 && response.status < 400;
      hop++
    ) {
      const location = response.headers.get("Location");
      if (!location) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
      if (!(await isAllowedUrlWithDnsCheck(nextUrl))) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
      currentUrl = nextUrl;
      response = await fetch(currentUrl, {
        headers: fetchHeaders,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
    }

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Could not fetch website" }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract data
    const data: Record<string, string | null> = {
      name: null,
      description_short: null,
      email: null,
      phone: null,
      logo_url: null,
      social_facebook: null,
      social_twitter: null,
      social_linkedin: null,
      social_instagram: null,
      suggested_anchor_text: null,
    };

    // Business name - try various sources
    data.name = $('meta[property="og:site_name"]').attr("content")
      || $('meta[name="application-name"]').attr("content")
      || $("title").text().split("|")[0].split("-")[0].trim()
      || null;

    // Description
    data.description_short = $('meta[property="og:description"]').attr("content")
      || $('meta[name="description"]').attr("content")
      || null;

    if (data.description_short && data.description_short.length > 500) {
      data.description_short = data.description_short.substring(0, 497) + "...";
    }

    // Logo
    const logoUrl = $('meta[property="og:image"]').attr("content")
      || $('link[rel="icon"]').attr("href")
      || $('link[rel="apple-touch-icon"]').attr("href");
    
    if (logoUrl) {
      // Make absolute URL if relative
      try {
        data.logo_url = new URL(logoUrl, normalizedUrl).href;
      } catch {
        data.logo_url = logoUrl;
      }
    }

    // Email - look for mailto links
    const emailMatch = html.match(/mailto:([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    if (emailMatch) {
      data.email = emailMatch[1];
    }

    // Phone - look for tel links
    const phoneMatch = html.match(/tel:([+0-9-() ]+)/i);
    if (phoneMatch) {
      data.phone = phoneMatch[1].trim();
    }

    // Social media links
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("facebook.com") && !data.social_facebook) {
        data.social_facebook = href;
      }
      if ((href.includes("twitter.com") || href.includes("x.com")) && !data.social_twitter) {
        data.social_twitter = href;
      }
      if (href.includes("linkedin.com") && !data.social_linkedin) {
        data.social_linkedin = href;
      }
      if (href.includes("instagram.com") && !data.social_instagram) {
        data.social_instagram = href;
      }
    });

    // Suggest anchor text from H1 or meta title
    const h1Text = $("h1").first().text().trim();
    const metaTitle = $("title").text().trim();

    if (h1Text && h1Text.length <= 100) {
      data.suggested_anchor_text = h1Text;
    } else if (metaTitle) {
      // Clean up meta title - remove common separators and site names
      const cleanTitle = metaTitle
        .split(/[\|\-–—]/)[0]
        .trim()
        .substring(0, 100);
      if (cleanTitle) {
        data.suggested_anchor_text = cleanTitle;
      }
    }

    return NextResponse.json({ data, website_url: normalizedUrl });
  } catch (error) {
    console.error("Autofill error:", error);
    return NextResponse.json({ error: "Could not extract data from website" }, { status: 500 });
  }
}
