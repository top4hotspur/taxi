import { NextResponse } from "next/server";
import { requireDriver } from "@/lib/auth/guards";

export async function GET() {
  await requireDriver();
  return NextResponse.json({ success: true, message: "Availability management will be added in a future phase." });
}
