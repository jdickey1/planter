import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/auth";

import { rateLimitByIP } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";

const ALLOWED_ORIGINS = ["https://linkplanter.com", "https://www.linkplanter.com"];

export async function POST(request: Request) {
  try {
  if (!validateOrigin(request, ALLOWED_ORIGINS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { success: rlOk } = rateLimitByIP(request, "forgot-password", 5, 900000);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }


    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get user - but do not reveal if they exist
    const user = await getUserByEmail(email);

    if (user) {
      const token = await createPasswordResetToken(user.id);
      // In production, send email with reset link
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
