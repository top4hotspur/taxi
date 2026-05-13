import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { adminPaymentReceivedEmail, customerPaymentConfirmedEmail } from "@/lib/email/templates";
import { getSquareClient, getSquareLocationId, toMinorUnits } from "@/lib/payments/square";

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();

  try {
    const user = await getCurrentSessionUser();
    if (!user || user.role !== "customer") {
      return NextResponse.json({ ok: false, error: "Unauthorized", errorCode: "UNAUTHORIZED", correlationId }, { status: 401 });
    }

    const body = (await request.json()) as { quoteId?: string; sourceId?: string };
    const quoteId = String(body.quoteId || "").trim();
    const sourceId = String(body.sourceId || "").trim();

    if (!quoteId || !sourceId) {
      return NextResponse.json({ ok: false, error: "Missing required payment fields.", errorCode: "VALIDATION_FAILED", correlationId }, { status: 400 });
    }

    const quote = await db.findQuoteById(quoteId);
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Quote not found.", errorCode: "QUOTE_NOT_FOUND", correlationId }, { status: 404 });
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const owned = quote.customerId === user.userId || (quote.guestEmail || "").trim().toLowerCase() === normalizedEmail;
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Forbidden", errorCode: "FORBIDDEN", correlationId }, { status: 403 });
    }

    const amount = Number(quote.confirmedPrice ?? quote.quotedPrice);
    const currency = "GBP";
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "This quote is not ready for payment.", errorCode: "PAYMENT_NOT_READY", correlationId }, { status: 400 });
    }

    const paymentStatus = quote.paymentStatus || "NOT_REQUIRED";
    if (paymentStatus === "PAID") {
      return NextResponse.json({ ok: true, message: "Quote already paid.", quoteId: quote.id, paymentStatus: "PAID", correlationId });
    }

    if (!["PAYMENT_REQUIRED", "PAYMENT_FAILED"].includes(paymentStatus)) {
      return NextResponse.json({ ok: false, error: "Payment is not currently enabled for this quote.", errorCode: "PAYMENT_STATUS_INVALID", correlationId }, { status: 400 });
    }

    const square = getSquareClient();
    const locationId = getSquareLocationId();
    const idempotencyKey = crypto.createHash("sha256").update(`${quote.id}:${amount}:${currency}:${sourceId.slice(0, 12)}`).digest("hex");

    const paymentResponse = await square.payments.create({
      sourceId,
      idempotencyKey,
      locationId,
      amountMoney: {
        amount: toMinorUnits(amount),
        currency,
      },
      note: `NI Taxi Co quote ${quote.id}`,
      referenceId: quote.id,
    });

    const payment = paymentResponse.payment;
    if (!payment || payment.status !== "COMPLETED") {
      const failReason = payment?.status || "PAYMENT_NOT_COMPLETED";
      await db.updateQuote(quote.id, {
        paymentStatus: "PAYMENT_FAILED",
        paymentFailureReason: failReason,
      }, { correlationId });

      return NextResponse.json({ ok: false, error: "Payment could not be completed. Please try again.", errorCode: "PAYMENT_FAILED", correlationId }, { status: 400 });
    }

    const updated = await db.updateQuote(quote.id, {
      paymentStatus: "PAID",
      paymentProvider: "SQUARE",
      squarePaymentId: payment.id,
      squareOrderId: payment.orderId,
      paymentAmount: amount,
      paymentCurrency: currency,
      paidAt: new Date().toISOString(),
      paymentFailureReason: undefined,
      status: quote.status === "QUOTED" ? "ACCEPTED" : quote.status,
    }, { correlationId });

    if (updated) {
      const recipient = quote.guestEmail || user.email;
      const customerMail = customerPaymentConfirmedEmail(updated, Boolean(quote.guestEmail));
      sendEmail({ to: recipient, subject: customerMail.subject, text: customerMail.text }).catch(() => undefined);

      const adminEmail = process.env.ADMIN_EMAIL?.trim();
      if (adminEmail) {
        const adminMail = adminPaymentReceivedEmail(updated);
        sendEmail({ to: adminEmail, subject: adminMail.subject, text: adminMail.text }).catch(() => undefined);
      }
    }

    return NextResponse.json({
      ok: true,
      correlationId,
      quoteId: quote.id,
      paymentStatus: "PAID",
      squarePaymentId: payment.id,
      paidAt: updated?.paidAt,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      source: "api.payments.square.pay-quote",
      correlationId,
      message: error instanceof Error ? error.message : "Unknown error",
    }));

    if (error instanceof Error && error.message.startsWith("SQUARE_CONFIG_MISSING")) {
      return NextResponse.json({ ok: false, error: "Payment is not configured yet.", errorCode: "SQUARE_CONFIG_MISSING", correlationId }, { status: 503 });
    }

    return NextResponse.json({ ok: false, error: "Unable to process payment right now.", errorCode: "PAYMENT_PROCESSING_ERROR", correlationId }, { status: 500 });
  }
}
