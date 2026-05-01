import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(user),
    isAdmin: isAdminUser(user),
  });
}
