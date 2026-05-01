import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const normalizedEmail = user.email.trim().toLowerCase();
  const allQuotes = await db.listQuotes();

  const customerIdMatches = allQuotes.filter((quote) => quote.customerId === user.userId);
  const emailMatches = allQuotes.filter((quote) => (quote.guestEmail || "").trim().toLowerCase() === normalizedEmail);

  const merged = new Map<string, (typeof allQuotes)[number]>();
  for (const quote of customerIdMatches) merged.set(quote.id, quote);
  for (const quote of emailMatches) merged.set(quote.id, quote);
  const quotes = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const withBooking = await Promise.all(quotes.map(async (q) => ({ ...q, booking: await db.getBookingForQuote(q.id) })));
  return NextResponse.json({
    success: true,
    quotes: withBooking,
    diagnostics: {
      customerEmail: normalizedEmail,
      matchedQuotes: quotes.length,
      matchedByCustomerId: customerIdMatches.length,
      matchedByEmail: emailMatches.length,
    },
  });
}
