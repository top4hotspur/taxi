import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "driver") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const profile = await db.getDriverProfileByUserId(user.userId);
  const documents = await db.listDriverDocumentsByUserId(user.userId);
  return NextResponse.json({ success: true, profile, documents });
}
