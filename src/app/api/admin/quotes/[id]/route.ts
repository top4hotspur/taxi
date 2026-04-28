import { NextResponse } from "next/server";
import type { QuoteStatusValue } from "@/lib/quote/constants";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { sendStatusLifecycleEmails, updateQuoteStatusAudit } from "@/lib/quote/service";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, quote: { ...quote, booking: await db.getBookingForQuote(id), audits: await db.getAuditsByQuote(id) } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { adminNotes?: string; quotedPrice?: number; quotedCurrency?: string; status?: QuoteStatusValue; action?: "mark_sent" | "create_booking" | "confirm_booking"; note?: string; };

  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  let nextStatus = body.status;
  if (body.action === "mark_sent") nextStatus = "QUOTE_SENT";
  if (body.action === "create_booking") nextStatus = "BOOKING_CREATED";
  if (body.action === "confirm_booking") nextStatus = "BOOKING_CONFIRMED";

  if (body.action === "create_booking") await db.upsertBooking(id, false);
  if (body.action === "confirm_booking") await db.upsertBooking(id, true);

  const updated = await db.updateQuote(id, {
    adminNotes: body.adminNotes ?? quote.adminNotes,
    quotedPrice: body.quotedPrice !== undefined ? Number(body.quotedPrice) : quote.quotedPrice,
    quotedCurrency: body.quotedCurrency || quote.quotedCurrency,
    status: nextStatus || quote.status,
  });

  if (updated && nextStatus && nextStatus !== quote.status) {
    await updateQuoteStatusAudit({ quoteId: id, changedByRole: "admin", changedByUserId: user.userId, previousStatus: quote.status, newStatus: nextStatus, note: body.note });
    await sendStatusLifecycleEmails({ quote: updated, newStatus: nextStatus });
  }

  return NextResponse.json({ success: true, quote: updated });
}
