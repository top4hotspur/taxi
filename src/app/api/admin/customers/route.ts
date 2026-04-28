import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ success: true, customers: await db.listCustomers() });
}
