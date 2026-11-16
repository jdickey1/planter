import { NextResponse } from "next/server";
import { clearSession, getSession, revokeSessions } from "@/lib/auth";

export async function POST() {
  try {
    // Revoke server-side first so a copied cookie stops working too.
    const session = await getSession();
    if (session) await revokeSessions(session.id);
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
