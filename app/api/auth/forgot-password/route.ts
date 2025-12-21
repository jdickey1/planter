import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
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
      console.log(`Password reset link: /reset-password?token=${token}`);
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
