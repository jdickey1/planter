import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface Listing {
  id: number;
  business_id: number;
  slug: string;
  is_published: boolean;
  is_dofollow: boolean;
  has_profile_page: boolean;
  featured_until: string | null;
  view_count: number;
  created_at: string;
  business_name: string;
  business_website_url: string;
  business_description_short: string;
  business_logo_url: string;
  business_city: string;
  business_state: string;
  target_anchor_text: string | null;
  industries: string[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    const slug = searchParams.get("slug");

    // Build query with filters
    let sql = `
      SELECT DISTINCT
        l.id, l.business_id, l.slug, l.is_published, l.is_dofollow,
        l.has_profile_page, l.featured_until, l.view_count, l.created_at,
        b.name as business_name,
        b.website_url as business_website_url,
        b.description_short as business_description_short,
        b.logo_url as business_logo_url,
        b.city as business_city,
        b.state as business_state,
        b.target_anchor_text,
        COALESCE(
          (SELECT array_agg(i.name)
           FROM listing_categories lc
           JOIN industries i ON lc.industry_id = i.id
           WHERE lc.listing_id = l.id),
          ARRAY[]::text[]
        ) as industries
      FROM listings l
      JOIN businesses b ON l.business_id = b.id
      WHERE l.is_published = true
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    // Filter by slug (for single listing lookup)
    if (slug) {
      sql += ` AND l.slug = $${paramIndex}`;
      params.push(slug);
      paramIndex++;
    }

    // Filter by category/industry
    if (category && category !== "all") {
      sql += ` AND EXISTS (
        SELECT 1 FROM listing_categories lc
        JOIN industries i ON lc.industry_id = i.id
        WHERE lc.listing_id = l.id AND i.slug = $${paramIndex}
      )`;
      params.push(category);
      paramIndex++;
    }

    // Filter by featured
    if (featured === "true") {
      sql += ` AND l.featured_until IS NOT NULL AND l.featured_until > NOW()`;
    }

    // Order by featured first, then by creation date
    sql += ` ORDER BY
      CASE WHEN l.featured_until IS NOT NULL AND l.featured_until > NOW() THEN 0 ELSE 1 END,
      l.created_at DESC
    `;

    const listings = await query<Listing>(sql, params);

    // Get categories for filter dropdown
    const categories = await query<{ slug: string; name: string }>(
      `SELECT slug, name FROM industries ORDER BY name`
    );

    return NextResponse.json({
      listings,
      categories,
      total: listings.length
    });
  } catch (error) {
    console.error("Get listings error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
