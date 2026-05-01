import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { runDriverComplianceReminders } from "@/lib/reminders/driverComplianceReminders";

export async function POST() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const summary = await runDriverComplianceReminders();
  return NextResponse.json({ success: true, summary });
}
