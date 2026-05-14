import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { adminPaymentReceivedEmail, customerPaymentConfirmedEmail } from "@/lib/email/templates";
import { getSquareClient, getSquareLocationId, toMinorUnits } from "@/lib/payments/square";
import { updateQuoteStatusAudit } from "@/lib/quote/service";

type SafeDiagnostics = {
  squareEnvironment: "sandbox" | "production" | "missing";
  squareAccessTokenPresent: boolean;
  squareLocationIdPresent: boolean;
  quoteFound: boolean;
  quoteOwnedByCustomer: boolean;
  confirmedPricePresent: boolean;
  confirmedPriceValue: number | null;
  paymentStatus: string;
  amountMinorUnits: number | null;
  squareErrorCategory: string | null;
  squareErrorCode: string | null;
  squareStatusCode: number | null;
};

function currentSquareEnvironment(): "sandbox" | "production" | "missing" {
  const raw = process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase();
  if (!raw) return "missing";
  return raw === "production" ? "production" : "sandbox";
}

function baseDiagnostics(): SafeDiagnostics {
  return {
    squareEnvironment: currentSquareEnvironment(),
    squareAccessTokenPresent: Boolean(process.env.SQUARE_ACCESS_TOKEN?.trim()),
    squareLocationIdPresent: Boolean(process.env.SQUARE_LOCATION_ID?.trim()),
    quoteFound: false,
    quoteOwnedByCustomer: false,
    confirmedPricePresent: false,
    confirmedPriceValue: null,
    paymentStatus: "UNKNOWN",
    amountMinorUnits: null,
    squareErrorCategory: null,
    squareErrorCode: null,
    squareStatusCode: null,
  };
}

function safeFailure(
  diagnostics: SafeDiagnostics,
  correlationId: string,
  status: number,
  errorCode: string,
  message = "Unable to process payment right now. Please try again or contact us."
) {
  return NextResponse.json({ ok: false, errorCode, message, diagnostics, correlationId }, { status });
}

function extractSquareError(err: unknown) {
  const asAny = err as {
    statusCode?: number;
    response?: { statusCode?: number; body?: unknown };
    body?: unknown;
    errors?: Array<{ category?: string; code?: string }>;
  };

  const body = asAny.body || asAny.response?.body;
  const bodyErrors = Array.isArray((body as { errors?: unknown })?.errors)
    ? ((body as { errors?: Array<{ category?: string; code?: string }> }).errors || [])
    : [];
  const topErrors = Array.isArray(asAny.errors) ? asAny.errors : [];
  const first = bodyErrors[0] || topErrors[0] || null;

  return {
    category: first?.category || null,
    code: first?.code || null,
    statusCode: asAny.statusCode || asAny.response?.statusCode || null,
  };
}

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const diagnostics = baseDiagnostics();

  try {
    const user = await getCurrentSessionUser();
    if (!user || user.role !== "customer") {
      return safeFailure(diagnostics, correlationId, 401, "UNAUTHORIZED");
    }

    const body = (await request.json()) as { quoteId?: string; sourceId?: string };
    const quoteId = String(body.quoteId || "").trim();
    const sourceId = String(body.sourceId || "").trim();

    if (!quoteId) {
      return safeFailure(diagnostics, correlationId, 400, "QUOTE_ID_MISSING");
    }
    if (!sourceId) {
      return safeFailure(diagnostics, correlationId, 400, "SOURCE_ID_MISSING");
    }

    const quote = await db.findQuoteById(quoteId);
    diagnostics.quoteFound = Boolean(quote);
    if (!quote) {
      return safeFailure(diagnostics, correlationId, 404, "QUOTE_NOT_FOUND");
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const owned = quote.customerId === user.userId || (quote.guestEmail || "").trim().toLowerCase() === normalizedEmail;
    diagnostics.quoteOwnedByCustomer = owned;
    if (!owned) {
      return safeFailure(diagnostics, correlationId, 403, "QUOTE_NOT_OWNED");
    }

    const confirmedPrice = Number(quote.confirmedPrice ?? quote.quotedPrice);
    diagnostics.confirmedPricePresent = Number.isFinite(confirmedPrice) && confirmedPrice > 0;
    diagnostics.confirmedPriceValue = Number.isFinite(confirmedPrice) ? confirmedPrice : null;

    if (!diagnostics.confirmedPricePresent) {
      return safeFailure(diagnostics, correlationId, 409, "CONFIRMED_PRICE_MISSING");
    }

    const paymentStatus = quote.paymentStatus || "NOT_REQUIRED";
    diagnostics.paymentStatus = paymentStatus;

    if (paymentStatus === "PAID") {
      return NextResponse.json({ ok: true, quoteId: quote.id, paymentStatus: "PAID", correlationId });
    }
    if (paymentStatus !== "PAYMENT_REQUIRED") {
      return safeFailure(diagnostics, correlationId, 409, "PAYMENT_STATUS_INVALID");
    }

    if (!diagnostics.squareAccessTokenPresent || !diagnostics.squareLocationIdPresent) {
      return safeFailure(diagnostics, correlationId, 503, "SQUARE_CONFIG_MISSING");
    }

    const amountMinorUnits = Number(toMinorUnits(confirmedPrice));
    diagnostics.amountMinorUnits = Number.isFinite(amountMinorUnits) ? amountMinorUnits : null;
    if (!diagnostics.amountMinorUnits || diagnostics.amountMinorUnits <= 0) {
      return safeFailure(diagnostics, correlationId, 400, "AMOUNT_INVALID");
    }

    const square = getSquareClient();
    const locationId = getSquareLocationId();
    const idempotencyKey = crypto.randomUUID();

    const paymentResponse = await square.payments.create({
      sourceId,
      idempotencyKey,
      locationId,
      amountMoney: {
        amount: BigInt(diagnostics.amountMinorUnits),
        currency: "GBP",
      },
      note: `NI Taxi Co quote ${quote.id}`,
      referenceId: quote.id,
    });

    const payment = paymentResponse.payment;
    if (!payment || payment.status !== "COMPLETED") {
      const failReason = payment?.status || "PAYMENT_NOT_COMPLETED";
      await db.updateQuote(
        quote.id,
        {
          paymentStatus: "PAYMENT_FAILED",
          paymentFailureReason: failReason,
        },
        { correlationId }
      );

      diagnostics.squareErrorCode = failReason;
      console.error(
        JSON.stringify({
          level: "error",
          source: "api.payments.square.pay-quote",
          correlationId,
          quoteId: quote.id,
          customerUserId: user.userId,
          customerEmail: normalizedEmail,
          squareEnvironment: diagnostics.squareEnvironment,
          amountMinorUnits: diagnostics.amountMinorUnits,
          squareErrorCode: diagnostics.squareErrorCode,
        })
      );

      return safeFailure(diagnostics, correlationId, 400, "PAYMENT_FAILED");
    }

    const updated = await db.updateQuote(
      quote.id,
      {
        status: quote.status === "QUOTED" ? "ACCEPTED" : quote.status,
        paymentStatus: "PAID",
        paymentProvider: "SQUARE",
        squarePaymentId: payment.id,
        squareOrderId: payment.orderId,
        paymentAmount: confirmedPrice,
        paymentCurrency: "GBP",
        paidAt: new Date().toISOString(),
        paymentFailureReason: undefined,
      },
      { correlationId }
    );

    if (updated && quote.status === "QUOTED") {
      await updateQuoteStatusAudit({
        quoteId: quote.id,
        changedByRole: "customer",
        changedByUserId: user.userId,
        previousStatus: quote.status,
        newStatus: "ACCEPTED",
        note: "Quote marked accepted after successful payment",
      });
    }

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
    const sqError = extractSquareError(error);
    diagnostics.squareErrorCategory = sqError.category;
    diagnostics.squareErrorCode = sqError.code;
    diagnostics.squareStatusCode = sqError.statusCode;

    console.error(
      JSON.stringify({
        level: "error",
        source: "api.payments.square.pay-quote",
        correlationId,
        squareEnvironment: diagnostics.squareEnvironment,
        amountMinorUnits: diagnostics.amountMinorUnits,
        squareErrorCategory: diagnostics.squareErrorCategory,
        squareErrorCode: diagnostics.squareErrorCode,
        squareStatusCode: diagnostics.squareStatusCode,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );

    const message = "Unable to process payment right now. Please try again or contact us.";
    return NextResponse.json(
      {
        ok: false,
        errorCode: "PAYMENT_PROCESSING_ERROR",
        message,
        diagnostics,
        correlationId,
      },
      { status: 500 }
    );
  }
}
