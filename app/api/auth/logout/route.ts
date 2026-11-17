import { NextResponse } from "next/server";
import { clearSession, getSession, revokeSessions } from "@/lib/auth";

export async function POST() {
  let revoked = true;
  try {
    // Revoke server-side first so a copied cookie stops working too.
    const session = await getSession();
    if (session) await revokeSessions(session.id);
  } catch (error) {
    console.error("Logout error:", error);
    revoked = false;
  }
  // Clear the browser cookie even when the revoke failed.
  await clearSession();
  if (!revoked) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
