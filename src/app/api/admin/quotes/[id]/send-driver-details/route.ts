import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { customerDriverDetailsEmail, driverJobDetailsEmail } from "@/lib/email/templates";
import { sendSms, sendWhatsApp } from "@/lib/notifications/twilio";

type ChannelResult = "sent" | "skipped" | "failed";

type NotificationSummary = {
  customerEmail: ChannelResult;
  customerWhatsApp: ChannelResult;
  customerSms: ChannelResult;
  customerSmsAttempted: boolean;
  driverEmail: ChannelResult;
  driverWhatsApp: ChannelResult;
  driverSms: ChannelResult;
  driverSmsAttempted: boolean;
  detailMessages: string[];
};

function formatJourneyShort(quote: Awaited<ReturnType<typeof db.findQuoteById>>) {
  if (!quote) return "";
  return `${quote.pickupDate} ${quote.pickupTime} ${quote.pickupLocation} -> ${quote.dropoffLocation}`;
}

function readableSkippedReason(reason?: string) {
  switch (reason) {
    case "WHATSAPP_NOT_CONFIGURED":
      return "not configured";
    case "WHATSAPP_DISABLED":
      return "disabled";
    case "WHATSAPP_INPUT_INVALID":
      return "invalid phone/message";
    case "SMS_NOT_CONFIGURED":
      return "not configured";
    case "SMS_INPUT_INVALID":
      return "invalid phone/message";
    default:
      return reason || "skipped";
  }
}

function whatsappFailureMessage(result: { error?: string; reason?: string }) {
  if (result.reason === "WHATSAPP_TEMPLATE_REQUIRED") {
    return "approved template required";
  }
  return result.error || "Unknown error";
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Quote not found." }, { status: 404 });
  if (quote.paymentStatus !== "PAID") {
    return NextResponse.json({ success: false, message: "Quote must be paid before sending driver details." }, { status: 400 });
  }
  if (!quote.assignedDriverId || !quote.assignedDriverName || !quote.assignedDriverPhone) {
    return NextResponse.json({ success: false, message: "Assign a driver first." }, { status: 400 });
  }

  const summary: NotificationSummary = {
    customerEmail: "skipped",
    customerWhatsApp: "skipped",
    customerSms: "skipped",
    customerSmsAttempted: false,
    driverEmail: "skipped",
    driverWhatsApp: "skipped",
    driverSms: "skipped",
    driverSmsAttempted: false,
    detailMessages: [],
  };

  const customerEmailTo = (quote.guestEmail || (quote.customerId ? (await db.findUserById(quote.customerId))?.email : "") || "").trim();
  const customerPhoneTo = (quote.guestPhone || quote.passengerPhone || "").trim();
  const driverEmailTo = (quote.assignedDriverEmail || "").trim();
  const driverPhoneTo = (quote.assignedDriverPhone || "").trim();

  const nowIso = new Date().toISOString();
  let customerDriverEmailSentAt: string | undefined;
  let customerDriverSmsSentAt: string | undefined;
  let driverJobEmailSentAt: string | undefined;
  let driverJobSmsSentAt: string | undefined;
  let customerWhatsAppSentAt: string | undefined;
  let driverWhatsAppSentAt: string | undefined;
  let customerWhatsAppStatus = quote.customerWhatsAppStatus || "SKIPPED";
  let driverWhatsAppStatus = quote.driverWhatsAppStatus || "SKIPPED";
  let customerWhatsAppError = quote.customerWhatsAppError;
  let driverWhatsAppError = quote.driverWhatsAppError;

  if (customerEmailTo) {
    try {
      const emailPayload = customerDriverDetailsEmail(quote, quote.guestName || quote.passengerName);
      const result = await sendEmail({ to: customerEmailTo, subject: emailPayload.subject, text: emailPayload.text });
      if (result.ok) {
        summary.customerEmail = "sent";
        customerDriverEmailSentAt = nowIso;
      } else {
        summary.customerEmail = "failed";
        summary.detailMessages.push(`Customer email failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      summary.customerEmail = "failed";
      summary.detailMessages.push(`Customer email failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    summary.customerEmail = "skipped";
    summary.detailMessages.push("Customer email skipped: no customer email available.");
  }

  if (customerPhoneTo) {
    const customerTemplateSid = process.env.TWILIO_WHATSAPP_CUSTOMER_DRIVER_TEMPLATE_SID?.trim();
    const whatsapp = await sendWhatsApp({
      to: customerPhoneTo,
      body: `NI Taxi Co: Your driver is ${quote.assignedDriverName}. Vehicle: ${quote.assignedVehicleColour || ""} ${quote.assignedVehicleMake || "vehicle"} ${quote.assignedVehicleRegistration || ""}. Driver phone: ${quote.assignedDriverPhone}. Journey: ${formatJourneyShort(quote)}. Please keep these details available.`,
      contentSid: customerTemplateSid || undefined,
      contentVariables: customerTemplateSid
        ? {
            "1": quote.assignedDriverName || "Driver",
            "2": `${quote.assignedVehicleColour || ""} ${quote.assignedVehicleMake || "vehicle"} ${quote.assignedVehicleRegistration || ""}`.trim(),
            "3": quote.assignedDriverPhone || "",
            "4": `${quote.pickupDate} ${quote.pickupTime}`,
          }
        : undefined,
    });
    if (whatsapp.ok) {
      summary.customerWhatsApp = "sent";
      customerWhatsAppSentAt = nowIso;
      customerWhatsAppStatus = "SENT";
      customerWhatsAppError = undefined;
    } else if (whatsapp.skipped) {
      summary.customerWhatsApp = "skipped";
      customerWhatsAppStatus = "SKIPPED";
      customerWhatsAppError = readableSkippedReason(whatsapp.reason);
      summary.detailMessages.push(`Customer WhatsApp skipped: ${readableSkippedReason(whatsapp.reason)}`);
    } else {
      summary.customerWhatsApp = "failed";
      customerWhatsAppStatus = "FAILED";
      customerWhatsAppError = whatsappFailureMessage(whatsapp);
      summary.detailMessages.push(`Customer WhatsApp failed: ${customerWhatsAppError}`);

      summary.customerSmsAttempted = true;
      const smsFallback = await sendSms({
        to: customerPhoneTo,
        body: `NI Taxi Co: Your driver is ${quote.assignedDriverName}, ${quote.assignedVehicleColour || ""} ${quote.assignedVehicleMake || "vehicle"} reg ${quote.assignedVehicleRegistration || "TBC"}. Driver phone: ${quote.assignedDriverPhone}. Journey: ${formatJourneyShort(quote)}.`,
      });
      if (smsFallback.ok) {
        summary.customerSms = "sent";
        customerDriverSmsSentAt = nowIso;
      } else if (smsFallback.skipped) {
        summary.customerSms = "skipped";
        summary.detailMessages.push(`Customer SMS skipped: ${readableSkippedReason(smsFallback.reason)}`);
      } else {
        summary.customerSms = "failed";
        summary.detailMessages.push(`Customer SMS failed: ${smsFallback.error || "Unknown error"}`);
      }
    }
  } else {
    summary.customerWhatsApp = "skipped";
    customerWhatsAppStatus = "SKIPPED";
    customerWhatsAppError = "no customer phone available";
    summary.detailMessages.push("Customer WhatsApp skipped: no customer phone available.");
  }

  if (driverEmailTo) {
    try {
      const emailPayload = driverJobDetailsEmail(quote);
      const result = await sendEmail({ to: driverEmailTo, subject: emailPayload.subject, text: emailPayload.text });
      if (result.ok) {
        summary.driverEmail = "sent";
        driverJobEmailSentAt = nowIso;
      } else {
        summary.driverEmail = "failed";
        summary.detailMessages.push(`Driver email failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      summary.driverEmail = "failed";
      summary.detailMessages.push(`Driver email failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    summary.driverEmail = "skipped";
    summary.detailMessages.push("Driver email skipped: no driver email available.");
  }

  if (driverPhoneTo) {
    const driverTemplateSid = process.env.TWILIO_WHATSAPP_DRIVER_JOB_TEMPLATE_SID?.trim();
    const whatsapp = await sendWhatsApp({
      to: driverPhoneTo,
      body: `NI Taxi Co job: ${quote.pickupDate} ${quote.pickupTime}. Pickup: ${quote.pickupLocation}. Drop-off: ${quote.dropoffLocation}. Passenger: ${(quote.guestName || quote.passengerName || "Customer")} ${quote.guestPhone || quote.passengerPhone || ""}. Check your email for full details.`,
      contentSid: driverTemplateSid || undefined,
      contentVariables: driverTemplateSid
        ? {
            "1": `${quote.pickupDate} ${quote.pickupTime}`,
            "2": quote.pickupLocation,
            "3": quote.dropoffLocation,
            "4": quote.guestName || quote.passengerName || "Customer",
            "5": quote.guestPhone || quote.passengerPhone || "",
          }
        : undefined,
    });
    if (whatsapp.ok) {
      summary.driverWhatsApp = "sent";
      driverWhatsAppSentAt = nowIso;
      driverWhatsAppStatus = "SENT";
      driverWhatsAppError = undefined;
    } else if (whatsapp.skipped) {
      summary.driverWhatsApp = "skipped";
      driverWhatsAppStatus = "SKIPPED";
      driverWhatsAppError = readableSkippedReason(whatsapp.reason);
      summary.detailMessages.push(`Driver WhatsApp skipped: ${readableSkippedReason(whatsapp.reason)}`);
    } else {
      summary.driverWhatsApp = "failed";
      driverWhatsAppStatus = "FAILED";
      driverWhatsAppError = whatsappFailureMessage(whatsapp);
      summary.detailMessages.push(`Driver WhatsApp failed: ${driverWhatsAppError}`);

      summary.driverSmsAttempted = true;
      const smsFallback = await sendSms({
        to: driverPhoneTo,
        body: `NI Taxi Co job: ${quote.pickupDate} ${quote.pickupTime}. Pickup ${quote.pickupLocation}. Drop-off ${quote.dropoffLocation}. Passenger: ${(quote.guestName || quote.passengerName || "Customer")} ${quote.guestPhone || quote.passengerPhone || ""}. Check email/admin for full details.`,
      });
      if (smsFallback.ok) {
        summary.driverSms = "sent";
        driverJobSmsSentAt = nowIso;
      } else if (smsFallback.skipped) {
        summary.driverSms = "skipped";
        summary.detailMessages.push(`Driver SMS skipped: ${readableSkippedReason(smsFallback.reason)}`);
      } else {
        summary.driverSms = "failed";
        summary.detailMessages.push(`Driver SMS failed: ${smsFallback.error || "Unknown error"}`);
      }
    }
  } else {
    summary.driverWhatsApp = "skipped";
    driverWhatsAppStatus = "SKIPPED";
    driverWhatsAppError = "no driver phone available";
    summary.detailMessages.push("Driver WhatsApp skipped: no driver phone available.");
  }

  const requiredEmailFailed = summary.customerEmail !== "sent" || summary.driverEmail !== "sent";

  const updated = await db.updateQuote(id, {
    assignmentStatus: requiredEmailFailed ? "FAILED_TO_SEND" : "DETAILS_SENT",
    driverDetailsSentAt: summary.customerEmail === "sent" ? nowIso : quote.driverDetailsSentAt,
    driverJobSentAt: summary.driverEmail === "sent" ? nowIso : quote.driverJobSentAt,
    customerDriverEmailSentAt: customerDriverEmailSentAt || quote.customerDriverEmailSentAt,
    customerDriverSmsSentAt: customerDriverSmsSentAt || quote.customerDriverSmsSentAt,
    driverJobEmailSentAt: driverJobEmailSentAt || quote.driverJobEmailSentAt,
    driverJobSmsSentAt: driverJobSmsSentAt || quote.driverJobSmsSentAt,
    customerWhatsAppSentAt: customerWhatsAppSentAt || quote.customerWhatsAppSentAt,
    driverWhatsAppSentAt: driverWhatsAppSentAt || quote.driverWhatsAppSentAt,
    customerWhatsAppStatus,
    driverWhatsAppStatus,
    customerWhatsAppError,
    driverWhatsAppError,
    lastCommunicationError: requiredEmailFailed ? summary.detailMessages.join(" | ").slice(0, 1000) : undefined,
  });

  const topLevelMessage = requiredEmailFailed
    ? "Required email notifications failed. Please review below."
    : "Required emails sent. WhatsApp/SMS results are shown below.";

  return NextResponse.json({
    success: true,
    message: topLevelMessage,
    notificationSummary: summary,
    quote: updated,
  });
}
