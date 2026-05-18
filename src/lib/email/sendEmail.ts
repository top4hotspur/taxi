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
  providerMessageId?: string | null;
  providerStatus?: string | null;
  errorCode?: "EMAIL_NOT_CONFIGURED" | "EMAIL_RECIPIENT_MISSING" | "EMAIL_SEND_FAILED";
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
  const recipient = String(input.to || "").trim();

  if (!recipient) {
    return {
      ok: false,
      skipped: true,
      provider: provider || "resend",
      errorCode: "EMAIL_RECIPIENT_MISSING",
      error: "Recipient email is missing",
      providerMessageId: null,
      providerStatus: "skipped",
    };
  }

  if (provider !== "resend" || !apiKey || !from) {
    warnStructured("email_provider_not_configured", {
      provider,
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
      to: recipient,
      subject: input.subject,
    });
    return {
      ok: false,
      skipped: true,
      provider: "resend",
      errorCode: "EMAIL_NOT_CONFIGURED",
      error: "Email provider not configured",
      providerMessageId: null,
      providerStatus: "skipped",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({ from, to: recipient, subject: input.subject, text: input.text, html: input.html });
    const providerMessageId = response?.data?.id || null;
    if (response?.error) {
      warnStructured("email_send_failed", {
        to: recipient,
        subject: input.subject,
        error: response.error.message || "Unknown provider error",
      });
      return {
        ok: false,
        skipped: false,
        provider: "resend",
        errorCode: "EMAIL_SEND_FAILED",
        error: response.error.message || "Email send failed",
        providerMessageId,
        providerStatus: "failed",
      };
    }
    return {
      ok: true,
      skipped: false,
      provider: "resend",
      providerMessageId,
      providerStatus: "accepted",
    };
  } catch (error) {
    warnStructured("email_send_failed", {
      to: recipient,
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ok: false,
      skipped: false,
      provider: "resend",
      errorCode: "EMAIL_SEND_FAILED",
      error: error instanceof Error ? error.message : "Unknown error",
      providerMessageId: null,
      providerStatus: "failed",
    };
  }
}
