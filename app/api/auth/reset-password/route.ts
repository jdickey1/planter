import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth";
import { rateLimitByIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // ponytail: in-memory per-IP limit like forgot-password; shared store if this runs multi-instance.
    const { success: rlOk } = rateLimitByIP(request, "reset-password", 10, 900000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const { token, password } = await request.json();

    if (!token || !password || typeof token !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Consume the token and set the password atomically; also revokes sessions.
    const userId = await resetPasswordWithToken(token, password);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password has been reset. You can now log in."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
