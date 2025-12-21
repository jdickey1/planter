import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

interface Directory {
  id: number;
  name: string;
  slug: string;
  url: string;
  da_score: number | null;
  dr_score: number | null;
  difficulty: string;
  submission_type: string;
  avg_approval_days: number | null;
  is_free: boolean;
  is_premium: boolean;
  instructions: string | null;
  submission_url: string | null;
  industries: string[];
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get("difficulty");
    const premium = searchParams.get("premium");
    const industry = searchParams.get("industry");
    const search = searchParams.get("search");

    // Build query with filters
    let sql = `
      SELECT DISTINCT
        d.id, d.name, d.slug, d.url, d.da_score, d.dr_score,
        d.difficulty, d.submission_type, d.avg_approval_days,
        d.is_free, d.is_premium, d.instructions, d.submission_url,
        COALESCE(
          (SELECT array_agg(i.name)
           FROM directory_industries di
           JOIN industries i ON di.industry_id = i.id
           WHERE di.directory_id = d.id),
          ARRAY[]::text[]
        ) as industries
      FROM directories d
      WHERE d.is_active = true
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (difficulty && difficulty !== "all") {
      sql += ` AND d.difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    if (premium === "true") {
      sql += ` AND d.is_premium = true`;
    } else if (premium === "false") {
      sql += ` AND d.is_premium = false`;
    }

    if (industry && industry !== "all") {
      sql += ` AND EXISTS (
        SELECT 1 FROM directory_industries di
        JOIN industries i ON di.industry_id = i.id
        WHERE di.directory_id = d.id AND i.slug = $${paramIndex}
      )`;
      params.push(industry);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (d.name ILIKE $${paramIndex} OR d.url ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY d.is_premium DESC, d.da_score DESC NULLS LAST`;

    const directories = await query<Directory>(sql, params);

    // Get industries for filter dropdown
    const industries = await query<{ slug: string; name: string }>(
      `SELECT slug, name FROM industries ORDER BY name`
    );

    // Get counts for stats
    const stats = await query<{ total: number; premium: number; easy: number; medium: number; hard: number }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_premium) as premium,
        COUNT(*) FILTER (WHERE difficulty = 'easy') as easy,
        COUNT(*) FILTER (WHERE difficulty = 'medium') as medium,
        COUNT(*) FILTER (WHERE difficulty = 'hard') as hard
      FROM directories WHERE is_active = true
    `);

    return NextResponse.json({
      directories,
      industries,
      stats: stats[0] || { total: 0, premium: 0, easy: 0, medium: 0, hard: 0 }
    });
  } catch (error) {
    console.error("Get directories error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
