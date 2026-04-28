import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { runDriverComplianceReminders } from "@/lib/reminders/driverComplianceReminders";

export async function POST() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDriverComplianceReminders();
  return NextResponse.json({ success: true, summary });
}
