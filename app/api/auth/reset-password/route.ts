import { NextResponse } from "next/server";
import { verifyPasswordResetToken, usePasswordResetToken, updatePassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
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

    // Verify token
    const userId = await verifyPasswordResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Update password
    await updatePassword(userId, password);

    // Mark token as used
    await usePasswordResetToken(token);

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
