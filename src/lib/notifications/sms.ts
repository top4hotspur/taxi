type SmsResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string;
  error?: string;
};

type SendSmsInput = {
  to: string;
  message: string;
};

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

export async function sendSms(input: SendSmsInput): Promise<SmsResult> {
  const to = String(input.to || "").trim();
  const body = String(input.message || "").trim();
  if (!to || !body) {
    return { ok: false, skipped: true, reason: "SMS_INPUT_INVALID" };
  }

  if (!twilioConfigured()) {
    return { ok: false, skipped: true, reason: "SMS_NOT_CONFIGURED" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body.slice(0, 1300));

  try {
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: form,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const twilioError = payload && typeof payload.message === "string" ? payload.message : `HTTP_${response.status}`;
      console.error(`[sms] Twilio send failed to=${to} status=${response.status} error=${twilioError}`);
      return { ok: false, error: twilioError };
    }
    const sid = payload && typeof payload.sid === "string" ? payload.sid : undefined;
    return { ok: true, providerMessageId: sid };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown SMS failure";
    console.error(`[sms] Twilio send exception to=${to} error=${msg}`);
    return { ok: false, error: msg };
  }
}
