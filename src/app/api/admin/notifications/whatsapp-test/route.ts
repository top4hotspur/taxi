import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { normalizePhoneForDisplay, sendWhatsApp } from "@/lib/notifications/twilio";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { to?: string; template?: "customer" | "driver"; message?: string };
  const to = String(body.to || "").trim();
  const template = body.template || "customer";
  const message = String(body.message || "NI Taxi Co WhatsApp test message.").trim();

  if (!to) {
    return NextResponse.json({ ok: false, errorCode: "TO_REQUIRED", message: "Recipient number is required." }, { status: 400 });
  }

  const customerSid = process.env.TWILIO_WHATSAPP_CUSTOMER_DRIVER_TEMPLATE_SID?.trim();
  const driverSid = process.env.TWILIO_WHATSAPP_DRIVER_JOB_TEMPLATE_SID?.trim();
  const templateSid = template === "driver" ? driverSid : customerSid;
  const normalizedRecipient = normalizePhoneForDisplay(to);
  const fromLooksValid = String(process.env.TWILIO_WHATSAPP_FROM || "").trim().toLowerCase().startsWith("whatsapp:+");
  const templateSidLooksValid = Boolean(templateSid && /^HX[a-zA-Z0-9]{32}$/.test(templateSid));

  const result = await sendWhatsApp(
    template === "driver"
      ? {
          to,
          contentSid: templateSid,
          contentVariables: {
            "1": "28/05/2026 16:06",
            "2": "Belfast City Airport",
            "3": "16 Cregagh Park",
            "4": "Steven Glass",
            "5": "07917221111",
          },
        }
      : {
          to,
          contentSid: templateSid,
          contentVariables: {
            "1": "Steven Glass",
            "2": "07917221111",
            "3": "Grey Ford Galaxy GX16LYR",
            "4": "Belfast City Airport",
            "5": "16 Cregagh Park",
            "6": "28/05/2026 16:06",
          },
          body: message,
        }
  );

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      status: "queued",
      messageSid: result.providerMessageId || null,
      twilioStatus: result.twilioStatus ?? null,
      normalizedRecipient,
      templateSidPresent: Boolean(templateSid),
      templateSidLooksValid,
      fromLooksValid,
    });
  }

  if (result.skipped) {
    return NextResponse.json(
      {
        ok: false,
        status: "skipped",
        errorCode: result.reason || "WHATSAPP_SKIPPED",
        safeMessage: result.safeMessage || result.error || "WhatsApp was skipped.",
        twilioStatus: result.twilioStatus ?? null,
        twilioErrorCode: result.twilioErrorCode ?? result.errorCode ?? null,
        normalizedRecipient,
        templateSidPresent: Boolean(templateSid),
        templateSidLooksValid,
        fromLooksValid,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      status: "failed",
      errorCode: result.reason || "TWILIO_SEND_FAILED",
      safeMessage: result.safeMessage || result.error || "WhatsApp send failed.",
      twilioStatus: result.twilioStatus ?? null,
      twilioErrorCode: result.twilioErrorCode ?? result.errorCode ?? null,
      normalizedRecipient,
      templateSidPresent: Boolean(templateSid),
      templateSidLooksValid,
      fromLooksValid,
    },
    { status: 502 }
  );
}
