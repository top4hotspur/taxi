import { NextResponse } from "next/server";
import { normalizeQuoteStatus, type QuoteStatusValue } from "@/lib/quote/constants";
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
  const body = (await request.json()) as { adminNotes?: string; adminCustomerMessage?: string; quotedPrice?: number; quotedCurrency?: string; status?: QuoteStatusValue; action?: "mark_awaiting" | "mark_quoted" | "mark_accepted" | "mark_declined" | "mark_cancelled"; note?: string; };

  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  let nextStatus = body.status;
  if (body.action === "mark_awaiting") nextStatus = "AWAITING_CONFIRMATION";
  if (body.action === "mark_quoted") nextStatus = "QUOTED";
  if (body.action === "mark_accepted") nextStatus = "ACCEPTED";
  if (body.action === "mark_declined") nextStatus = "DECLINED";
  if (body.action === "mark_cancelled") nextStatus = "CANCELLED";

  const updated = await db.updateQuote(id, {
    adminNotes: body.adminNotes ?? quote.adminNotes,
    adminCustomerMessage: body.adminCustomerMessage ?? quote.adminCustomerMessage,
    quotedPrice: body.quotedPrice !== undefined ? Number(body.quotedPrice) : quote.quotedPrice,
    quotedCurrency: body.quotedCurrency || quote.quotedCurrency,
    status: nextStatus ? normalizeQuoteStatus(nextStatus) : quote.status,
  });

  if (updated && nextStatus && normalizeQuoteStatus(nextStatus) !== normalizeQuoteStatus(quote.status)) {
    await updateQuoteStatusAudit({ quoteId: id, changedByRole: "admin", changedByUserId: user?.userId, previousStatus: quote.status, newStatus: normalizeQuoteStatus(nextStatus), note: body.note });
    await sendStatusLifecycleEmails({ quote: updated, newStatus: normalizeQuoteStatus(nextStatus) });
  }

  const customer = updated?.customerId ? await db.findUserById(updated.customerId) : null;
  return NextResponse.json({ success: true, quote: updated ? { ...updated, customerEmail: customer?.email || null } : updated });
}
