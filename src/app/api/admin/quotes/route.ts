import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const quotes = await db.filterQuotes({
    status: searchParams.get("status") || undefined,
    serviceType: searchParams.get("serviceType") || undefined,
    fromDate: searchParams.get("fromDate") || undefined,
    toDate: searchParams.get("toDate") || undefined,
  });

  const hydrated = await Promise.all(quotes.map(async (quote) => ({
    ...quote,
    booking: await db.getBookingForQuote(quote.id),
    customer: quote.customerId ? await db.findUserById(quote.customerId) : null,
  })));

  return NextResponse.json({ success: true, quotes: hydrated });
}
