import { NextResponse } from "next/server";
import type { QuoteStatusValue } from "@/lib/quote/constants";
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
  const quote = (await db.findQuotesByCustomer(user.userId)).find((q) => q.id === id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, quote: { ...toCustomerQuoteView(quote), booking: await db.getBookingForQuote(id), audits: await db.getAuditsByQuote(id) } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { action?: "accept" | "decline" };
  const quote = (await db.findQuotesByCustomer(user.userId)).find((q) => q.id === id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  let newStatus: QuoteStatusValue | null = null;
  if (body.action === "accept" && quote.status === "QUOTE_SENT") newStatus = "QUOTE_ACCEPTED";
  if (body.action === "decline" && quote.status === "QUOTE_SENT") newStatus = "QUOTE_DECLINED";
  if (!newStatus) return NextResponse.json({ success: false, message: "Invalid transition" }, { status: 400 });

  const updated = await db.updateQuote(id, { status: newStatus });
  await updateQuoteStatusAudit({ quoteId: id, changedByRole: "customer", changedByUserId: user.userId, previousStatus: quote.status, newStatus, note: `Customer ${body.action}ed quote` });

  if (updated) await sendStatusLifecycleEmails({ quote: updated, newStatus });

  return NextResponse.json({ success: true, quote: toCustomerQuoteView(updated) });
}
