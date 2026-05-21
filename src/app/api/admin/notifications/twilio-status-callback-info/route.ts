import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const siteUrl = process.env.SITE_URL?.trim();
  const callbackUrl = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/twilio/status` : null;
  const authTokenPresent = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());

  return NextResponse.json({
    ok: true,
    callbackUrl,
    siteUrlPresent: Boolean(siteUrl),
    twilioAuthTokenPresent: authTokenPresent,
    signatureVerificationEnabled: process.env.NODE_ENV === "production" && authTokenPresent,
    message: "Configure this URL as Twilio status callback for delivery updates.",
  });
}
