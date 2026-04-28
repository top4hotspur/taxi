import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookie.name);
  return NextResponse.json({ success: true });
}
