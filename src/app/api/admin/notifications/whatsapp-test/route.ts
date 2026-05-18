import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { sendWhatsApp } from "@/lib/notifications/twilio";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { to?: string; message?: string };
  const to = String(body.to || "").trim();
  const message = String(body.message || "NI Taxi Co WhatsApp test message.").trim();

  if (!to) {
    return NextResponse.json({ ok: false, errorCode: "TO_REQUIRED", message: "Recipient number is required." }, { status: 400 });
  }

  const result = await sendWhatsApp({ to, body: message });
  if (result.ok) {
    return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId || null });
  }

  if (result.skipped) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "WHATSAPP_SKIPPED",
        message: "WhatsApp test skipped.",
        reason: result.reason || null,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      errorCode: "WHATSAPP_SEND_FAILED",
      message: result.reason === "WHATSAPP_TEMPLATE_REQUIRED" ? "WhatsApp failed: approved template required." : "WhatsApp test failed.",
      reason: result.reason || null,
      providerErrorCode: result.errorCode || null,
    },
    { status: 502 }
  );
}
