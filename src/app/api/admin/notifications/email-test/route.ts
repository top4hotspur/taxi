import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { sendEmail } from "@/lib/email/sendEmail";

type EmailTestBody = {
  to?: string;
  type?: "customer-driver" | "driver-job" | "simple";
};

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as EmailTestBody;
  const to = String(body.to || "").trim();
  const type = body.type || "simple";

  if (!to) {
    return NextResponse.json({ ok: false, status: "failed", errorCode: "EMAIL_RECIPIENT_MISSING", safeMessage: "Recipient email is required." }, { status: 400 });
  }

  const subject =
    type === "customer-driver"
      ? "NI Taxi Co test: customer driver details email"
      : type === "driver-job"
        ? "NI Taxi Co test: driver job details email"
        : "NI Taxi Co test email";
  const text =
    type === "customer-driver"
      ? "This is a test customer driver details email from NI Taxi Co."
      : type === "driver-job"
        ? "This is a test driver job details email from NI Taxi Co."
        : "This is a simple NI Taxi Co email test.";

  const result = await sendEmail({ to, subject, text });

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      status: "sent",
      provider: "RESEND",
      providerMessageId: result.providerMessageId || null,
      providerStatusCode: result.providerStatusCode ?? null,
      from: result.from || null,
      to: result.to || to,
      subject: result.subject || subject,
      apiKeyPresent: Boolean(result.apiKeyPresent),
      emailFromPresent: Boolean(result.emailFromPresent),
      safeMessage: "Email accepted by provider.",
    });
  }

  return NextResponse.json(
    {
      ok: false,
      status: result.skipped ? "skipped" : "failed",
      provider: "RESEND",
      providerMessageId: result.providerMessageId || null,
      errorCode: result.errorCode || "EMAIL_SEND_FAILED",
      providerErrorMessage: result.providerErrorMessage || result.error || "Email send failed.",
      providerStatusCode: result.providerStatusCode ?? null,
      from: result.from || null,
      to: result.to || to,
      subject: result.subject || subject,
      apiKeyPresent: Boolean(result.apiKeyPresent),
      emailFromPresent: Boolean(result.emailFromPresent),
      safeMessage: result.error || "Email send failed.",
    },
    { status: result.skipped ? 400 : 502 }
  );
}
