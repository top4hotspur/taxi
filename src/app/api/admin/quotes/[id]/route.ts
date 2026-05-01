import { NextResponse } from "next/server";
import type { QuoteStatusValue } from "@/lib/quote/constants";
import { db } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { sendStatusLifecycleEmails, updateQuoteStatusAudit } from "@/lib/quote/service";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  const customer = quote.customerId ? await db.findUserById(quote.customerId) : null;

  return NextResponse.json({
    success: true,
    quote: {
      ...quote,
      customerEmail: customer?.email || null,
      booking: await db.getBookingForQuote(id),
      audits: await db.getAuditsByQuote(id),
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json()) as { adminNotes?: string; quotedPrice?: number; quotedCurrency?: string; status?: QuoteStatusValue; action?: "mark_updated" | "mark_sent" | "create_booking" | "confirm_booking"; note?: string; };

  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  let nextStatus = body.status;
  if (body.action === "mark_updated") nextStatus = "QUOTE_UPDATED";
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
    await updateQuoteStatusAudit({ quoteId: id, changedByRole: "admin", changedByUserId: user?.userId, previousStatus: quote.status, newStatus: nextStatus, note: body.note });
    await sendStatusLifecycleEmails({ quote: updated, newStatus: nextStatus });
  }

  const customer = updated?.customerId ? await db.findUserById(updated.customerId) : null;
  return NextResponse.json({ success: true, quote: updated ? { ...updated, customerEmail: customer?.email || null } : updated });
}
