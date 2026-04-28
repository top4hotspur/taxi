import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });

  const user = await db.findUserByEmail(body.email);
  if (!user || !comparePassword(body.password, user.passwordHash)) {
    return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
  }

  const token = createSessionToken({ userId: user.id, email: user.email, role: user.role === "ADMIN" ? "admin" : user.role === "DRIVER" ? "driver" : "customer" });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, token, sessionCookie.options);

  return NextResponse.json({ success: true, role: user.role });
}
