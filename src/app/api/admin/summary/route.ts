import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const quotes = await db.listQuotes();
  return NextResponse.json({
    success: true,
    summary: {
      totalQuotes: quotes.length,
      pendingQuoteRequests: quotes.filter((q) => q.status === "SUBMITTED" || q.status === "AWAITING_CONFIRMATION").length,
      quotesSent: quotes.filter((q) => q.status === "QUOTED").length,
      acceptedQuotes: quotes.filter((q) => q.status === "ACCEPTED").length,
      bookingsCreated: quotes.filter((q) => q.status === "AWAITING_CONFIRMATION").length,
      bookingsConfirmed: quotes.filter((q) => q.status === "ACCEPTED").length,
    },
  });
}
