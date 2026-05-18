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
  providerStatusCode?: number | null;
  providerErrorName?: string | null;
  providerErrorMessage?: string | null;
  resendErrorCode?: string | null;
  resendErrorType?: string | null;
  from?: string;
  to?: string;
  subject?: string;
  apiKeyPresent?: boolean;
  emailFromPresent?: boolean;
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
      providerStatusCode: null,
      providerErrorName: "EMAIL_RECIPIENT_MISSING",
      providerErrorMessage: "Recipient email is missing",
      from,
      to: recipient,
      subject: input.subject,
      apiKeyPresent: Boolean(apiKey),
      emailFromPresent: Boolean(from),
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
      error: !apiKey ? "Resend API key missing" : !from ? "EMAIL_FROM is missing" : "Email provider not configured",
      providerMessageId: null,
      providerStatus: "skipped",
      providerStatusCode: null,
      providerErrorName: "EMAIL_NOT_CONFIGURED",
      providerErrorMessage: !apiKey ? "Resend API key missing" : !from ? "EMAIL_FROM is missing" : "Email provider not configured",
      from,
      to: recipient,
      subject: input.subject,
      apiKeyPresent: Boolean(apiKey),
      emailFromPresent: Boolean(from),
    };
  }

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({ from, to: recipient, subject: input.subject, text: input.text, html: input.html });
    const providerMessageId = response?.data?.id || null;
    if (response?.error) {
      const resendAny = response.error as unknown as { name?: string; message?: string; statusCode?: number; code?: string; type?: string };
      const safeProviderMessage =
        resendAny?.message || "Resend returned an error. Check sender/domain verification and recipient validity.";
      warnStructured("email_send_failed", {
        to: recipient,
        subject: input.subject,
        error: safeProviderMessage,
        providerErrorName: resendAny?.name || null,
        providerStatusCode: resendAny?.statusCode ?? null,
        resendErrorCode: resendAny?.code || null,
        resendErrorType: resendAny?.type || null,
        from,
        apiKeyPresent: Boolean(apiKey),
        emailFromPresent: Boolean(from),
      });
      return {
        ok: false,
        skipped: false,
        provider: "resend",
        errorCode: "EMAIL_SEND_FAILED",
        error: safeProviderMessage,
        providerMessageId,
        providerStatus: "failed",
        providerStatusCode: resendAny?.statusCode ?? null,
        providerErrorName: resendAny?.name || "RESEND_ERROR",
        providerErrorMessage: safeProviderMessage,
        resendErrorCode: resendAny?.code || null,
        resendErrorType: resendAny?.type || null,
        from,
        to: recipient,
        subject: input.subject,
        apiKeyPresent: Boolean(apiKey),
        emailFromPresent: Boolean(from),
      };
    }
    return {
      ok: true,
      skipped: false,
      provider: "resend",
      providerMessageId,
      providerStatus: "accepted",
      providerStatusCode: 200,
      providerErrorName: null,
      providerErrorMessage: null,
      resendErrorCode: null,
      resendErrorType: null,
      from,
      to: recipient,
      subject: input.subject,
      apiKeyPresent: Boolean(apiKey),
      emailFromPresent: Boolean(from),
    };
  } catch (error) {
    const err = error as { name?: string; message?: string; statusCode?: number; code?: string; type?: string };
    warnStructured("email_send_failed", {
      to: recipient,
      subject: input.subject,
      error: err?.message || "Unknown error",
      providerErrorName: err?.name || null,
      providerStatusCode: err?.statusCode ?? null,
      resendErrorCode: err?.code || null,
      resendErrorType: err?.type || null,
      from,
      apiKeyPresent: Boolean(apiKey),
      emailFromPresent: Boolean(from),
    });
    return {
      ok: false,
      skipped: false,
      provider: "resend",
      errorCode: "EMAIL_SEND_FAILED",
      error: err?.message || "Unknown error",
      providerMessageId: null,
      providerStatus: "failed",
      providerStatusCode: err?.statusCode ?? null,
      providerErrorName: err?.name || "RESEND_ERROR",
      providerErrorMessage: err?.message || "Unknown error",
      resendErrorCode: err?.code || null,
      resendErrorType: err?.type || null,
      from,
      to: recipient,
      subject: input.subject,
      apiKeyPresent: Boolean(apiKey),
      emailFromPresent: Boolean(from),
    };
  }
}
