import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.getCustomerProfileByUserId(user.userId);

  return NextResponse.json({
    ok: true,
    user: {
      userId: user.userId,
      email: user.email,
      role: user.role,
    },
    profile: profile
      ? {
          name: profile.name,
          phone: profile.phone,
          accountType: profile.accountType,
        }
      : null,
  });
}
