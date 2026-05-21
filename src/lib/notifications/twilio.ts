export type TwilioChannelResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string;
  safeMessage?: string;
  error?: string;
  errorCode?: string;
  twilioStatus?: number | null;
  twilioErrorCode?: string | null;
  twilioDeliveryStatus?: string | null;
  normalizedRecipient?: string;
  statusCallbackConfigured?: boolean;
};

export type SendPhoneMessageInput = {
  to: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
};

function normalizePhone(raw: string) {
  const input = String(raw || "").trim();
  if (!input) return "";
  if (input.toLowerCase().startsWith("whatsapp:")) {
    return normalizePhone(input.slice("whatsapp:".length));
  }

  let cleaned = input.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  if (cleaned.startsWith("0")) cleaned = `+44${cleaned.slice(1)}`;
  if (!cleaned.startsWith("+")) cleaned = `+${cleaned}`;
  return cleaned;
}

function whatsappEnabled() {
  return String(process.env.ENABLE_WHATSAPP_NOTIFICATIONS || "").trim().toLowerCase() === "true";
}

function twilioBaseConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim());
}

function whatsappFromConfigured() {
  return Boolean(process.env.TWILIO_WHATSAPP_FROM?.trim());
}

function whatsappTemplateConfigured(kind: "customer" | "driver") {
  const value = kind === "customer"
    ? process.env.TWILIO_WHATSAPP_CUSTOMER_DRIVER_TEMPLATE_SID?.trim()
    : process.env.TWILIO_WHATSAPP_DRIVER_JOB_TEMPLATE_SID?.trim();
  return Boolean(value);
}

function smsConfigured() {
  return Boolean(twilioBaseConfigured() && process.env.TWILIO_FROM_NUMBER?.trim());
}

function mapTwilioError(result: TwilioChannelResult): TwilioChannelResult {
  const text = `${result.error || ""} ${result.errorCode || ""}`.toLowerCase();
  if (text.includes("authenticate") || text.includes("auth")) {
    return { ...result, reason: "TWILIO_AUTH_FAILED", safeMessage: "Twilio authentication failed." };
  }
  if (text.includes("template") || text.includes("contentsid")) {
    return {
      ...result,
      reason: "WHATSAPP_TEMPLATE_REJECTED_OR_NOT_APPROVED",
      safeMessage: "WhatsApp template is rejected, not approved, or not eligible for this channel.",
    };
  }
  if (text.includes("outside of the allowed window") || text.includes("window")) {
    return {
      ...result,
      reason: "WHATSAPP_RECIPIENT_NOT_OPTED_IN_OR_WINDOW_CLOSED",
      safeMessage: "Recipient is outside the allowed WhatsApp messaging window or not opted in.",
    };
  }
  if (text.includes("business-initiated") || text.includes("unapproved")) {
    return {
      ...result,
      reason: "WHATSAPP_BUSINESS_INITIATED_NOT_APPROVED",
      safeMessage: "Business-initiated WhatsApp messaging is not approved for this sender/template.",
    };
  }
  if (text.includes("to") || text.includes("recipient") || text.includes("phone") || text.includes("whatsapp")) {
    return { ...result, reason: "WHATSAPP_RECIPIENT_INVALID", safeMessage: "Recipient phone number is invalid for WhatsApp." };
  }
  return { ...result, reason: "TWILIO_SEND_FAILED", safeMessage: "Twilio could not send this WhatsApp message." };
}

async function sendTwilioMessage(params: {
  to: string;
  from: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN!.trim();

  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("From", params.from);
  if (params.contentSid) {
    form.set("ContentSid", params.contentSid);
    if (params.contentVariables && Object.keys(params.contentVariables).length > 0) {
      form.set("ContentVariables", JSON.stringify(params.contentVariables));
    }
  } else if (params.body) {
    form.set("Body", params.body.slice(0, 1300));
  }
  const siteUrl = process.env.SITE_URL?.trim();
  const statusCallback = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/twilio/status` : "";
  if (statusCallback) {
    form.set("StatusCallback", statusCallback);
  }

  const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: form,
  });

  const payload = await response.json().catch(() => null) as
    | { sid?: string; message?: string; code?: number; status?: string }
    | null;

  if (!response.ok) {
    const errorText = payload?.message || `HTTP_${response.status}`;
    const errorCode = payload?.code ? String(payload.code) : undefined;
    return {
      ok: false,
      error: errorText,
      errorCode,
      twilioStatus: response.status,
      twilioErrorCode: errorCode || null,
      twilioDeliveryStatus: payload?.status || null,
    } as TwilioChannelResult;
  }

  return {
    ok: true,
    providerMessageId: payload?.sid,
    twilioStatus: response.status,
    twilioDeliveryStatus: payload?.status || null,
    statusCallbackConfigured: Boolean(statusCallback),
  } as TwilioChannelResult;
}

export async function sendWhatsApp(input: SendPhoneMessageInput): Promise<TwilioChannelResult> {
  const normalized = normalizePhone(input.to);
  if (!normalized) {
    return { ok: false, skipped: true, reason: "WHATSAPP_RECIPIENT_INVALID", normalizedRecipient: "" };
  }
  if (!whatsappEnabled()) {
    return { ok: false, skipped: true, reason: "WHATSAPP_DISABLED", normalizedRecipient: normalized };
  }
  if (!twilioBaseConfigured() || !whatsappFromConfigured()) {
    return { ok: false, skipped: true, reason: "WHATSAPP_NOT_CONFIGURED", normalizedRecipient: normalized };
  }
  if (!input.contentSid) {
    return { ok: false, skipped: true, reason: "WHATSAPP_TEMPLATE_NOT_CONFIGURED", normalizedRecipient: normalized };
  }
  if (!input.body && (!input.contentVariables || Object.keys(input.contentVariables).length === 0)) {
    return { ok: false, skipped: true, reason: "WHATSAPP_INPUT_INVALID", normalizedRecipient: normalized };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM!.trim();
  const to = normalized.toLowerCase().startsWith("whatsapp:") ? normalized : `whatsapp:${normalized}`;
  const result = await sendTwilioMessage({
    to,
    from,
    body: input.body,
    contentSid: input.contentSid,
    contentVariables: input.contentVariables,
  });

  if (!result.ok) return { ...mapTwilioError(result), normalizedRecipient: normalized };
  return { ...result, normalizedRecipient: normalized };
}

export async function sendSms(input: SendPhoneMessageInput): Promise<TwilioChannelResult> {
  const normalized = normalizePhone(input.to);
  if (!normalized || !input.body) {
    return { ok: false, skipped: true, reason: "SMS_INPUT_INVALID" };
  }
  if (!smsConfigured()) {
    return { ok: false, skipped: true, reason: "SMS_NOT_CONFIGURED" };
  }

  const from = process.env.TWILIO_FROM_NUMBER!.trim();
  return sendTwilioMessage({
    to: normalized,
    from,
    body: input.body,
  });
}

export function getTwilioNotificationHealth() {
  const twilioAccountSidPresent = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim());
  const twilioAuthTokenPresent = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
  const whatsappFromPresent = Boolean(process.env.TWILIO_WHATSAPP_FROM?.trim());
  const whatsappNotificationsEnabled = whatsappEnabled();
  const smsFromNumberPresent = Boolean(process.env.TWILIO_FROM_NUMBER?.trim());
  const customerWhatsAppTemplatePresent = whatsappTemplateConfigured("customer");
  const driverWhatsAppTemplatePresent = whatsappTemplateConfigured("driver");
  const siteUrl = process.env.SITE_URL?.trim();
  const twilioStatusCallbackUrl = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/twilio/status` : null;
  const twilioStatusCallbackConfigured = Boolean(siteUrl && twilioAuthTokenPresent);
  const twilioWebhookSignatureVerificationEnabled = process.env.NODE_ENV === "production" && twilioAuthTokenPresent;

  return {
    twilioAccountSidPresent,
    twilioAuthTokenPresent,
    whatsappFromPresent,
    whatsappNotificationsEnabled,
    smsFromNumberPresent,
    customerWhatsAppTemplatePresent,
    driverWhatsAppTemplatePresent,
    twilioStatusCallbackConfigured,
    twilioStatusCallbackUrl,
    twilioWebhookSignatureVerificationEnabled,
    whatsappConfigured:
      twilioAccountSidPresent &&
      twilioAuthTokenPresent &&
      whatsappFromPresent &&
      whatsappNotificationsEnabled &&
      customerWhatsAppTemplatePresent &&
      driverWhatsAppTemplatePresent,
  };
}

export function normalizePhoneForDisplay(raw: string) {
  return normalizePhone(raw);
}
