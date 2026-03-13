import { NextResponse } from "next/server";
import { createUser, getUserByEmail, setSessionCookie, toSessionUser } from "@/lib/auth";

import { rateLimitByIP } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";

const ALLOWED_ORIGINS = ["https://linkplanter.com", "https://www.linkplanter.com"];

export async function POST(request: Request) {
  try {
  if (!validateOrigin(request, ALLOWED_ORIGINS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { success: rlOk } = rateLimitByIP(request, "register", 5, 900000);
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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Create user
    const user = await createUser(email, password);

    // Set session cookie
    await setSessionCookie(toSessionUser(user));

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
