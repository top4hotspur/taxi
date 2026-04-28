import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const quotes = await db.findQuotesByCustomer(user.userId);
  const withBooking = await Promise.all(quotes.map(async (q) => ({ ...q, booking: await db.getBookingForQuote(q.id) })));
  return NextResponse.json({ success: true, quotes: withBooking });
}
