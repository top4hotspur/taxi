import { NextResponse } from "next/server";
import { normalizeQuoteStatus, type QuoteStatusValue } from "@/lib/quote/constants";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { sendStatusLifecycleEmails, updateQuoteStatusAudit } from "@/lib/quote/service";

function toCustomerQuoteView<T extends { adminNotes?: string } | null | undefined>(quote: T) {
  if (!quote) return quote;
  const safeQuote = { ...quote };
  delete safeQuote.adminNotes;
  return safeQuote;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const normalizedEmail = user.email.trim().toLowerCase();
  const quote = (await db.listQuotes()).find(
    (q) => q.id === id && (q.customerId === user.userId || (q.guestEmail || "").trim().toLowerCase() === normalizedEmail)
  );
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, quote: { ...toCustomerQuoteView(quote), booking: await db.getBookingForQuote(id), audits: await db.getAuditsByQuote(id) } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { action?: "accept" | "decline" };
  const normalizedEmail = user.email.trim().toLowerCase();
  const quote = (await db.listQuotes()).find(
    (q) => q.id === id && (q.customerId === user.userId || (q.guestEmail || "").trim().toLowerCase() === normalizedEmail)
  );
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  let newStatus: QuoteStatusValue | null = null;
  if (body.action === "accept" && normalizeQuoteStatus(quote.status) === "QUOTED") newStatus = "ACCEPTED";
  if (body.action === "decline" && normalizeQuoteStatus(quote.status) === "QUOTED") newStatus = "DECLINED";
  if (!newStatus) return NextResponse.json({ success: false, message: "Invalid transition" }, { status: 400 });

  const updated = await db.updateQuote(id, { status: newStatus });
  await updateQuoteStatusAudit({ quoteId: id, changedByRole: "customer", changedByUserId: user.userId, previousStatus: quote.status, newStatus, note: `Customer ${body.action}ed quote` });

  if (updated) await sendStatusLifecycleEmails({ quote: updated, newStatus });

  return NextResponse.json({ success: true, quote: toCustomerQuoteView(updated) });
}
