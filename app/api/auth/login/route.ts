import { NextResponse } from "next/server";
import { getUserByEmail, verifyPassword, setSessionCookie, toSessionUser } from "@/lib/auth";

import { rateLimitByIP } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";

const ALLOWED_ORIGINS = ["https://linkplanter.com", "https://www.linkplanter.com"];

export async function POST(request: Request) {
  try {
  if (!validateOrigin(request, ALLOWED_ORIGINS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { success: rlOk } = rateLimitByIP(request, "login", 5, 900000);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }


    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Get user
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Set session cookie
    await setSessionCookie(toSessionUser(user));

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
