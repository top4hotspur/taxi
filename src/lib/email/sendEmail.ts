import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailResult {
  ok: boolean;
  skipped: boolean;
  provider?: string;
  error?: string;
}

function envConfig() {
  return {
    provider: process.env.EMAIL_PROVIDER || "",
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "",
  };
}

function warnStructured(reason: string, meta?: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      level: "warn",
      source: "email",
      reason,
      meta: meta || {},
      at: new Date().toISOString(),
    })
  );
}

export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const { provider, apiKey, from } = envConfig();

  if (provider !== "resend" || !apiKey || !from) {
    warnStructured("email_provider_not_configured", {
      provider,
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
      to: input.to,
      subject: input.subject,
    });
    return { ok: false, skipped: true, error: "Email provider not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to: input.to, subject: input.subject, text: input.text, html: input.html });
    return { ok: true, skipped: false, provider: "resend" };
  } catch (error) {
    warnStructured("email_send_failed", {
      to: input.to,
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { ok: false, skipped: false, provider: "resend", error: error instanceof Error ? error.message : "Unknown error" };
  }
}
