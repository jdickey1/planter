import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

interface Business {
  id: number;
  user_id: number;
  name: string;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  description_short: string | null;
  description_long: string | null;
  logo_url: string | null;
  industry_id: number | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  social_instagram: string | null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const business = await queryOne<Business>(
      "SELECT * FROM businesses WHERE user_id = $1",
      [session.id]
    );

    return NextResponse.json({ business });
  } catch (error) {
    console.error("Get business error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const data = await request.json();

    // Check if business already exists
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM businesses WHERE user_id = $1",
      [session.id]
    );

    if (existing) {
      // Update existing business
      const business = await queryOne<Business>(
        `UPDATE businesses SET
          name = $1,
          website_url = $2,
          email = $3,
          phone = $4,
          description_short = $5,
          description_long = $6,
          logo_url = $7,
          address_line1 = $8,
          address_line2 = $9,
          city = $10,
          state = $11,
          postal_code = $12,
          country = $13,
          social_facebook = $14,
          social_twitter = $15,
          social_linkedin = $16,
          social_instagram = $17,
          updated_at = NOW()
        WHERE user_id = $18
        RETURNING *`,
        [
          data.name,
          data.website_url || null,
          data.email || null,
          data.phone || null,
          data.description_short || null,
          data.description_long || null,
          data.logo_url || null,
          data.address_line1 || null,
          data.address_line2 || null,
          data.city || null,
          data.state || null,
          data.postal_code || null,
          data.country || "United States",
          data.social_facebook || null,
          data.social_twitter || null,
          data.social_linkedin || null,
          data.social_instagram || null,
          session.id
        ]
      );

      return NextResponse.json({ business, updated: true });
    } else {
      // Create new business
      const business = await queryOne<Business>(
        `INSERT INTO businesses (
          user_id, name, website_url, email, phone, description_short, description_long,
          logo_url, address_line1, address_line2, city, state, postal_code, country,
          social_facebook, social_twitter, social_linkedin, social_instagram
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          session.id,
          data.name,
          data.website_url || null,
          data.email || null,
          data.phone || null,
          data.description_short || null,
          data.description_long || null,
          data.logo_url || null,
          data.address_line1 || null,
          data.address_line2 || null,
          data.city || null,
          data.state || null,
          data.postal_code || null,
          data.country || "United States",
          data.social_facebook || null,
          data.social_twitter || null,
          data.social_linkedin || null,
          data.social_instagram || null
        ]
      );

      return NextResponse.json({ business, created: true });
    }
  } catch (error) {
    console.error("Save business error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
