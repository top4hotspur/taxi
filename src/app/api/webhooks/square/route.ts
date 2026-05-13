import { NextResponse } from "next/server";

// TODO: Implement verified Square webhook handling before launch.
// Expected events: payment.updated, refund.updated, dispute.created.
// Do not trust unsigned payloads.
export async function POST() {
  return NextResponse.json({ ok: false, message: "Square webhook handling is not enabled yet." }, { status: 501 });
}
