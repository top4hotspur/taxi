import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const quotes = await db.listQuotes();
  return NextResponse.json({
    success: true,
    summary: {
      totalQuotes: quotes.length,
      pendingQuoteRequests: quotes.filter((q) => q.status === "QUOTE_REQUESTED").length,
      quotesSent: quotes.filter((q) => q.status === "QUOTE_SENT").length,
      acceptedQuotes: quotes.filter((q) => q.status === "QUOTE_ACCEPTED").length,
      bookingsCreated: quotes.filter((q) => q.status === "BOOKING_CREATED").length,
      bookingsConfirmed: quotes.filter((q) => q.status === "BOOKING_CONFIRMED").length,
    },
  });
}
