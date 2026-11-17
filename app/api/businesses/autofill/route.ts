import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import * as cheerio from "cheerio";
import { rateLimit } from "@/lib/rate-limit";
import { safeFetchHtml, SafeFetchError } from "@/lib/safe-fetch";

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // metadata lives in <head>; 2 MB is plenty
const TIMEOUT_MS = 10_000;
const MAX_URL_LENGTH = 2048;
const RATE_LIMIT = 10; // requests per account per window
const RATE_WINDOW_MS = 60_000;
const MAX_IN_FLIGHT = 2; // concurrent requests per account

// ponytail: in-process counters, like lib/rate-limit; move both to a shared store if this runs on more than one process.
const inFlight = new Map<number, number>();

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!rateLimit(`autofill:${session.id}`, RATE_LIMIT, RATE_WINDOW_MS).success) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const { url } = await request.json();

    if (!url || typeof url !== "string" || url.length > MAX_URL_LENGTH) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    if (!URL.canParse(normalizedUrl)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Check and claim a concurrency slot with no await in between.
    if ((inFlight.get(session.id) ?? 0) >= MAX_IN_FLIGHT) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
    // One validated, address-pinned connection per hop (see lib/safe-fetch).
    let html: string;
    inFlight.set(session.id, (inFlight.get(session.id) ?? 0) + 1);
    try {
      ({ html } = await safeFetchHtml(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPlanter/1.0; +https://linkplanter.com)",
          "Accept": "text/html,application/xhtml+xml;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
        maxRedirects: MAX_REDIRECTS,
        maxBytes: MAX_BODY_BYTES,
        timeoutMs: TIMEOUT_MS,
      }));
    } catch (error) {
      if (error instanceof SafeFetchError) {
        const message = error.reason === "blocked" ? "Invalid URL" : "Could not fetch website";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw error;
    } finally {
      const n = (inFlight.get(session.id) ?? 1) - 1;
      if (n > 0) inFlight.set(session.id, n);
      else inFlight.delete(session.id);
    }

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
