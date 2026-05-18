export type TwilioChannelResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
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

function whatsappConfigured() {
  return Boolean(twilioBaseConfigured() && process.env.TWILIO_WHATSAPP_FROM?.trim() && whatsappEnabled());
}

function smsConfigured() {
  return Boolean(twilioBaseConfigured() && process.env.TWILIO_FROM_NUMBER?.trim());
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
    | { sid?: string; message?: string; code?: number }
    | null;

  if (!response.ok) {
    const errorText = payload?.message || `HTTP_${response.status}`;
    const errorCode = payload?.code ? String(payload.code) : undefined;
    return { ok: false, error: errorText, errorCode } as TwilioChannelResult;
  }

  return { ok: true, providerMessageId: payload?.sid } as TwilioChannelResult;
}

export async function sendWhatsApp(input: SendPhoneMessageInput): Promise<TwilioChannelResult> {
  const normalized = normalizePhone(input.to);
  if (!normalized || (!input.body && !input.contentSid)) {
    return { ok: false, skipped: true, reason: "WHATSAPP_INPUT_INVALID" };
  }
  if (!whatsappEnabled()) {
    return { ok: false, skipped: true, reason: "WHATSAPP_DISABLED" };
  }
  if (!whatsappConfigured()) {
    return { ok: false, skipped: true, reason: "WHATSAPP_NOT_CONFIGURED" };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM!.trim();
  const to = `whatsapp:${normalized}`;
  const result = await sendTwilioMessage({
    to,
    from,
    body: input.body,
    contentSid: input.contentSid,
    contentVariables: input.contentVariables,
  });
  if (!result.ok && result.error?.toLowerCase().includes("template") && !input.contentSid) {
    return { ...result, reason: "WHATSAPP_TEMPLATE_REQUIRED" };
  }
  return result;
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

  return {
    twilioAccountSidPresent,
    twilioAuthTokenPresent,
    whatsappFromPresent,
    whatsappNotificationsEnabled,
    smsFromNumberPresent,
    whatsappConfigured: twilioAccountSidPresent && twilioAuthTokenPresent && whatsappFromPresent && whatsappNotificationsEnabled,
  };
}

export function normalizePhoneForDisplay(raw: string) {
  return normalizePhone(raw);
}
