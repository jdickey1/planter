import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import * as cheerio from "cheerio";

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

    // Fetch the website
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPlanter/1.0; +https://linkplanter.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

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

    return NextResponse.json({ data, website_url: normalizedUrl });
  } catch (error) {
    console.error("Autofill error:", error);
    return NextResponse.json({ error: "Could not extract data from website" }, { status: 500 });
  }
}
