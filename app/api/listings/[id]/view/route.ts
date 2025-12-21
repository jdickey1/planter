import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = parseInt(params.id);

    if (isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    // Increment view count
    await query(
      `UPDATE listings SET view_count = view_count + 1 WHERE id = $1`,
      [listingId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Increment view count error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
