import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db, type QuoteRecord } from "@/lib/db";

type InternalStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

const CALLBACK_PATH = "/api/webhooks/twilio/status";

function getCallbackUrl(request: Request) {
  const configuredSite = process.env.SITE_URL?.trim();
  if (configuredSite) return `${configuredSite.replace(/\/+$/, "")}${CALLBACK_PATH}`;
  return new URL(CALLBACK_PATH, request.url).toString();
}

function mapTwilioStatus(status: string): InternalStatus {
  const value = String(status || "").trim().toLowerCase();
  if (["delivered", "read"].includes(value)) return "DELIVERED";
  if (["failed", "undelivered"].includes(value)) return "FAILED";
  if (value === "sent") return "SENT";
  return "QUEUED";
}

function statusRank(status?: string) {
  switch (status) {
    case "FAILED":
      return 4;
    case "DELIVERED":
      return 3;
    case "SENT":
      return 2;
    case "QUEUED":
      return 1;
    default:
      return 0;
  }
}

function shouldTransition(previous: string | undefined, next: InternalStatus) {
  const prevRank = statusRank(previous);
  const nextRank = statusRank(next);
  if (previous === "FAILED" || previous === "DELIVERED") return false;
  return nextRank >= prevRank;
}

function validateTwilioSignature(request: Request, formValues: Record<string, string>) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) return false;
  const provided = request.headers.get("x-twilio-signature") || "";
  if (!provided) return false;
  const url = getCallbackUrl(request);
  const sortedKeys = Object.keys(formValues).sort((a, b) => a.localeCompare(b));
  const data = sortedKeys.reduce((acc, key) => `${acc}${key}${formValues[key] ?? ""}`, url);
  const computed = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const providedBuffer = Buffer.from(provided);
  const computedBuffer = Buffer.from(computed);
  if (providedBuffer.length !== computedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, computedBuffer);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value;
  }

  const production = process.env.NODE_ENV === "production";
  if (production && !validateTwilioSignature(request, fields)) {
    return NextResponse.json({ ok: false, errorCode: "INVALID_TWILIO_SIGNATURE" }, { status: 403 });
  }

  const messageSid = String(fields.MessageSid || "").trim();
  const twilioStatus = String(fields.MessageStatus || fields.SmsStatus || "").trim().toLowerCase();
  if (!messageSid || !twilioStatus) {
    return NextResponse.json({ ok: false, errorCode: "INVALID_CALLBACK_PAYLOAD" }, { status: 400 });
  }

  const quote = await db.findQuoteByCommunicationSid(messageSid);
  if (!quote) {
    return NextResponse.json({ ok: true, matched: false, messageSid });
  }

  const internalStatus = mapTwilioStatus(twilioStatus);
  const nowIso = new Date().toISOString();
  const errorCode = String(fields.ErrorCode || "").trim() || undefined;
  const errorMessage = String(fields.ErrorMessage || "").trim() || undefined;
  const isCustomer = quote.customerWhatsAppMessageSid === messageSid;
  const isDriver = quote.driverWhatsAppMessageSid === messageSid;

  const patch: Partial<QuoteRecord> = {};
  let channel: "CUSTOMER_WHATSAPP" | "DRIVER_WHATSAPP" | null = null;
  let previousStatus: string | undefined;
  if (isCustomer) {
    channel = "CUSTOMER_WHATSAPP";
    previousStatus = quote.customerWhatsAppStatus;
    if (shouldTransition(previousStatus, internalStatus)) {
      patch.customerWhatsAppStatus = internalStatus;
    }
    patch.customerWhatsAppTwilioStatus = twilioStatus;
    patch.customerWhatsAppTwilioStatusRaw = twilioStatus;
    patch.customerWhatsAppTwilioErrorCode = errorCode;
    patch.customerWhatsAppError = internalStatus === "FAILED" ? (errorCode || errorMessage || "TWILIO_DELIVERY_FAILED") : undefined;
    patch.customerWhatsAppStatusUpdatedAt = nowIso;
    if (internalStatus === "DELIVERED") patch.customerWhatsAppDeliveredAt = nowIso;
    if (internalStatus === "FAILED") patch.customerWhatsAppFailedAt = nowIso;
  } else if (isDriver) {
    channel = "DRIVER_WHATSAPP";
    previousStatus = quote.driverWhatsAppStatus;
    if (shouldTransition(previousStatus, internalStatus)) {
      patch.driverWhatsAppStatus = internalStatus;
    }
    patch.driverWhatsAppTwilioStatus = twilioStatus;
    patch.driverWhatsAppTwilioStatusRaw = twilioStatus;
    patch.driverWhatsAppTwilioErrorCode = errorCode;
    patch.driverWhatsAppError = internalStatus === "FAILED" ? (errorCode || errorMessage || "TWILIO_DELIVERY_FAILED") : undefined;
    patch.driverWhatsAppStatusUpdatedAt = nowIso;
    if (internalStatus === "DELIVERED") patch.driverWhatsAppDeliveredAt = nowIso;
    if (internalStatus === "FAILED") patch.driverWhatsAppFailedAt = nowIso;
  }

  if (!channel) {
    return NextResponse.json({ ok: true, matched: false, messageSid });
  }

  await db.updateQuote(quote.id, patch);
  await db.createAudit({
    quoteId: quote.id,
    changedByRole: "system",
    newStatus: "TWILIO_STATUS_CALLBACK",
    note: JSON.stringify({
      quoteId: quote.id,
      channel,
      messageSid,
      previousStatus: previousStatus || null,
      newStatus: internalStatus,
      rawTwilioStatus: twilioStatus,
      errorCode: errorCode || null,
      timestamp: nowIso,
    }),
  });

  return NextResponse.json({ ok: true, matched: true, quoteId: quote.id, channel, status: internalStatus });
}
