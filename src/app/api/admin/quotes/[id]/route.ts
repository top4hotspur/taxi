import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { normalizeQuoteStatus, type QuoteStatusValue } from "@/lib/quote/constants";
import { db } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { sendStatusLifecycleEmails, updateQuoteStatusAudit } from "@/lib/quote/service";
import { sendEmail } from "@/lib/email/sendEmail";
import { customerQuoteSentEmail } from "@/lib/email/templates";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  const customer = quote.customerId ? await db.findUserById(quote.customerId) : null;
  const customerProfile = quote.customerId ? await db.getCustomerProfileByUserId(quote.customerId) : null;

  return NextResponse.json({
    success: true,
    quote: {
      ...quote,
      customerEmail: customer?.email || null,
      customerProfileName: customerProfile?.name || null,
      booking: await db.getBookingForQuote(id),
      audits: await db.getAuditsByQuote(id),
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json()) as { adminNotes?: string; adminCustomerMessage?: string; quotedPrice?: number; quotedCurrency?: string; status?: QuoteStatusValue; action?: "mark_awaiting" | "mark_quoted" | "mark_payment_required" | "mark_accepted" | "mark_declined" | "mark_cancelled"; note?: string; };

  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  let nextStatus = body.status;
  if (body.action === "mark_awaiting") nextStatus = "AWAITING_CONFIRMATION";
  if (body.action === "mark_quoted") nextStatus = "QUOTED";
  if (body.action === "mark_payment_required") nextStatus = "QUOTED";
  if (body.action === "mark_accepted") nextStatus = "ACCEPTED";
  if (body.action === "mark_declined") nextStatus = "DECLINED";
  if (body.action === "mark_cancelled") nextStatus = "CANCELLED";

  const hasPriceUpdate = body.quotedPrice !== undefined && body.quotedPrice !== null && String(body.quotedPrice).trim() !== "";
  const nextQuotedPrice = hasPriceUpdate ? Number(body.quotedPrice) : quote.quotedPrice;
  const nextCurrency = "GBP";
  const hasValidConfirmedPrice = Number.isFinite(Number(nextQuotedPrice)) && Number(nextQuotedPrice) > 0;

  // v1 UX: confirmed price + update makes quote customer-actionable automatically.
  if (hasPriceUpdate && hasValidConfirmedPrice && (!nextStatus || nextStatus === "SUBMITTED" || nextStatus === "AWAITING_CONFIRMATION")) {
    nextStatus = "QUOTED";
  }

  const normalizedNextStatus = nextStatus ? normalizeQuoteStatus(nextStatus) : normalizeQuoteStatus(quote.status);
  const shouldEnablePayment = normalizedNextStatus === "QUOTED" || body.action === "mark_payment_required" || (hasPriceUpdate && hasValidConfirmedPrice);
  if (shouldEnablePayment && (!Number.isFinite(Number(nextQuotedPrice)) || Number(nextQuotedPrice) <= 0)) {
    return NextResponse.json({ success: false, message: "Confirmed quote price is required before requesting payment." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const nextQuotedAt =
    normalizedNextStatus === "QUOTED"
      ? quote.quotedAt || nowIso
      : quote.quotedAt;
  const quotedAtBase = nextQuotedAt || nowIso;
  const nextQuoteExpiresAt =
    normalizedNextStatus === "QUOTED"
      ? quote.quoteExpiresAt || new Date(Date.parse(quotedAtBase) + 24 * 60 * 60 * 1000).toISOString()
      : quote.quoteExpiresAt;

  const updated = await db.updateQuote(id, {
    adminNotes: body.adminNotes ?? quote.adminNotes,
    adminCustomerMessage: body.adminCustomerMessage ?? quote.adminCustomerMessage,
    quotedPrice: nextQuotedPrice,
    quotedCurrency: nextCurrency,
    confirmedPrice: hasValidConfirmedPrice ? Number(nextQuotedPrice) : quote.confirmedPrice,
    confirmedCurrency: nextCurrency,
    paymentStatus: shouldEnablePayment ? "PAYMENT_REQUIRED" : (quote.paymentStatus || "NOT_REQUIRED"),
    paymentProvider: shouldEnablePayment ? "SQUARE" : quote.paymentProvider,
    quotedAt: nextQuotedAt,
    quoteExpiresAt: nextQuoteExpiresAt,
    status: normalizedNextStatus,
  });

  if (updated && normalizedNextStatus !== normalizeQuoteStatus(quote.status)) {
    await updateQuoteStatusAudit({ quoteId: id, changedByRole: "admin", changedByUserId: user?.userId, previousStatus: quote.status, newStatus: normalizedNextStatus, note: body.note });
    await sendStatusLifecycleEmails({ quote: updated, newStatus: normalizedNextStatus });
  }

  const customer = updated?.customerId ? await db.findUserById(updated.customerId) : null;
  const customerProfile = updated?.customerId ? await db.getCustomerProfileByUserId(updated.customerId) : null;

  let quoteReadyEmailAttempted = false;
  let quoteReadyEmailStatus: "SENT" | "FAILED" | "SKIPPED" | "NOT_SENT" = "NOT_SENT";
  let quoteReadyEmailRecipient: string | null = null;
  let quoteReadyEmailProvider: string | null = null;
  let quoteReadyEmailProviderMessageId: string | null = null;
  let quoteReadyEmailProviderStatus: string | null = null;
  let quoteReadyEmailErrorCode: string | null = null;
  let quoteReadyEmailErrorMessage: string | null = null;
  let quoteReadyEmailSentAt: string | null = null;

  const becameActionable = Boolean(
    updated &&
      shouldEnablePayment &&
      hasValidConfirmedPrice &&
      normalizedNextStatus === "QUOTED" &&
      ((quote.paymentStatus || "NOT_REQUIRED") !== "PAYMENT_REQUIRED" || normalizeQuoteStatus(quote.status) !== "QUOTED" || hasPriceUpdate || (body.adminCustomerMessage !== undefined && body.adminCustomerMessage !== quote.adminCustomerMessage))
  );

  if (updated && becameActionable) {
    const recipientEmail = (updated.guestEmail || customer?.email || "").trim();
    quoteReadyEmailAttempted = true;
    quoteReadyEmailRecipient = recipientEmail || null;
    if (!recipientEmail) {
      quoteReadyEmailStatus = "SKIPPED";
      quoteReadyEmailErrorCode = "EMAIL_RECIPIENT_MISSING";
      quoteReadyEmailErrorMessage = "Recipient email is missing.";
    } else {
      try {
        const template = customerQuoteSentEmail(updated, Boolean(updated.guestEmail));
        const result = await sendEmail({ to: recipientEmail, subject: template.subject, text: template.text });
        quoteReadyEmailProvider = result.provider?.toUpperCase() || "RESEND";
        quoteReadyEmailProviderMessageId = result.providerMessageId || null;
        quoteReadyEmailProviderStatus = result.providerStatus || null;
        if (result.ok) {
          quoteReadyEmailStatus = "SENT";
          quoteReadyEmailSentAt = new Date().toISOString();
        } else if (result.skipped) {
          quoteReadyEmailStatus = "SKIPPED";
          quoteReadyEmailErrorCode = result.errorCode || "EMAIL_NOT_CONFIGURED";
          quoteReadyEmailErrorMessage = result.error || result.providerErrorMessage || "Email was skipped.";
        } else {
          quoteReadyEmailStatus = "FAILED";
          quoteReadyEmailErrorCode = result.errorCode || result.resendErrorCode || "EMAIL_SEND_FAILED";
          quoteReadyEmailErrorMessage = result.error || result.providerErrorMessage || "Email send failed.";
        }
      } catch (error) {
        quoteReadyEmailStatus = "FAILED";
        quoteReadyEmailErrorCode = "EMAIL_SEND_FAILED";
        quoteReadyEmailErrorMessage = error instanceof Error ? error.message : "Email send failed";
      }
    }

    const refreshed = await db.updateQuote(id, {
      quoteReadyEmailAttempted,
      quoteReadyEmailStatus,
      quoteReadyEmailRecipient: quoteReadyEmailRecipient || undefined,
      quoteReadyEmailProvider: quoteReadyEmailProvider === "RESEND" ? "RESEND" : undefined,
      quoteReadyEmailProviderMessageId: quoteReadyEmailProviderMessageId || undefined,
      quoteReadyEmailProviderStatus: quoteReadyEmailProviderStatus || undefined,
      quoteReadyEmailErrorCode: quoteReadyEmailErrorCode || undefined,
      quoteReadyEmailErrorMessage: quoteReadyEmailErrorMessage || undefined,
      quoteReadyEmailSentAt: quoteReadyEmailSentAt || undefined,
    });
    if (refreshed) {
      const attemptedAt = new Date().toISOString();
      await db.createAudit({
        quoteId: id,
        changedByRole: "admin",
        changedByUserId: user?.userId,
        previousStatus: normalizedNextStatus,
        newStatus: "QUOTE_READY_EMAIL_ATTEMPTED",
        note: JSON.stringify({
          recipient: quoteReadyEmailRecipient,
          status: quoteReadyEmailStatus,
          provider: quoteReadyEmailProvider || "RESEND",
          providerMessageId: quoteReadyEmailProviderMessageId,
          providerStatus: quoteReadyEmailProviderStatus,
          errorCode: quoteReadyEmailErrorCode,
          errorMessage: quoteReadyEmailErrorMessage,
          attemptedAt,
        }),
      });
      Object.assign(updated, refreshed);
    }
  }

  return NextResponse.json({
    success: true,
    quote: updated ? { ...updated, customerEmail: customer?.email || null, customerProfileName: customerProfile?.name || null } : updated,
    quoteReadyEmailAttempted,
    quoteReadyEmailStatus,
    quoteReadyEmailRecipient,
    quoteReadyEmailProvider: quoteReadyEmailProvider || "RESEND",
    quoteReadyEmailProviderMessageId,
    quoteReadyEmailProviderStatus,
    quoteReadyEmailErrorCode,
    quoteReadyEmailErrorMessage,
    quoteReadyEmailSentAt,
  });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const correlationId = crypto.randomUUID();

  const existing = await db.findQuoteById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Quote not found." }, { status: 404 });
  }

  try {
    await db.deleteQuoteAdmin(id, {
      correlationId,
      deletedByUserId: user?.userId,
      deletedByRole: "admin",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        source: "api.admin.quotes.delete",
        correlationId,
        quoteId: id,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );
    return NextResponse.json({ ok: false, message: "Could not delete quote." }, { status: 500 });
  }
}
