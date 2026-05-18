import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { customerDriverDetailsEmail, driverJobDetailsEmail } from "@/lib/email/templates";
import { formatUkDateTimeFromParts } from "@/lib/formatting";
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

function vehicleSummary(quote: Awaited<ReturnType<typeof db.findQuoteById>>) {
  if (!quote) return "Not provided";
  const parts = [quote.assignedVehicleColour, quote.assignedVehicleMake, quote.assignedVehicleRegistration].filter(Boolean);
  return parts.length ? parts.join(" ") : "Not provided";
}

function statusFromReason(reason?: string) {
  switch (reason) {
    case "WHATSAPP_NOT_CONFIGURED":
      return "WHATSAPP_NOT_CONFIGURED";
    case "WHATSAPP_TEMPLATE_NOT_CONFIGURED":
      return "WHATSAPP_TEMPLATE_NOT_CONFIGURED";
    case "WHATSAPP_TEMPLATE_REJECTED_OR_NOT_APPROVED":
      return "WHATSAPP_TEMPLATE_REJECTED_OR_NOT_APPROVED";
    case "WHATSAPP_RECIPIENT_INVALID":
      return "WHATSAPP_RECIPIENT_INVALID";
    case "TWILIO_AUTH_FAILED":
      return "TWILIO_AUTH_FAILED";
    case "TWILIO_SEND_FAILED":
      return "TWILIO_SEND_FAILED";
    default:
      return reason || "TWILIO_SEND_FAILED";
  }
}

function mapSkippedReason(reason?: string) {
  if (reason === "WHATSAPP_NOT_CONFIGURED") return "not configured";
  if (reason === "WHATSAPP_DISABLED") return "disabled";
  if (reason === "WHATSAPP_TEMPLATE_NOT_CONFIGURED") return "template not configured";
  if (reason === "WHATSAPP_RECIPIENT_INVALID") return "recipient invalid";
  return reason || "skipped";
}

function formatJourneyDateTime(quote: NonNullable<Awaited<ReturnType<typeof db.findQuoteById>>>) {
  return formatUkDateTimeFromParts(quote.pickupDate, quote.pickupTime);
}

function customerPhoneCandidates(params: {
  quote: NonNullable<Awaited<ReturnType<typeof db.findQuoteById>>>;
  profilePhone?: string;
  profileWhatsApp?: string;
}) {
  const q = params.quote as unknown as Record<string, unknown>;
  return [
    String(q.phone || "").trim(),
    String(q.bookerPhone || "").trim(),
    String(q.customerPhone || "").trim(),
    String(params.quote.guestPhone || "").trim(),
    String(params.profilePhone || "").trim(),
    String(params.profileWhatsApp || "").trim(),
    String(params.quote.passengerPhone || "").trim(),
    String(params.quote.leadPassengerPhone || "").trim(),
  ].find((value) => Boolean(value));
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

  const customerUser = quote.customerId ? await db.findUserById(quote.customerId) : null;
  const customerProfile = quote.customerId ? await db.getCustomerProfileByUserId(quote.customerId) : null;
  const assignedDriverProfile = quote.assignedDriverId ? await db.getDriverProfileById(quote.assignedDriverId) : null;

  const customerEmailTo = (quote.guestEmail || customerUser?.email || "").trim();
  const customerPhoneTo = customerPhoneCandidates({
    quote,
    profilePhone: customerProfile?.phone,
    profileWhatsApp: (customerProfile as unknown as { whatsapp?: string } | undefined)?.whatsapp,
  }) || "";
  const driverEmailTo = (quote.assignedDriverEmail || assignedDriverProfile?.email || "").trim();
  const driverPhoneTo = (quote.assignedDriverPhone || assignedDriverProfile?.mobile || "").trim();

  const nowIso = new Date().toISOString();
  let customerDriverEmailSentAt: string | undefined;
  let customerDriverSmsSentAt: string | undefined;
  let driverJobEmailSentAt: string | undefined;
  let driverJobSmsSentAt: string | undefined;
  let customerWhatsAppSentAt: string | undefined;
  let driverWhatsAppSentAt: string | undefined;
  let customerWhatsAppStatus: "SENT" | "SKIPPED" | "SKIPPED_NO_CUSTOMER_PHONE" | "FAILED" = "SKIPPED";
  let driverWhatsAppStatus: "SENT" | "SKIPPED" | "SKIPPED_NO_DRIVER_PHONE" | "FAILED" = "SKIPPED";
  let customerWhatsAppError: string | undefined;
  let driverWhatsAppError: string | undefined;

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

  const customerTemplateSid = process.env.TWILIO_WHATSAPP_CUSTOMER_DRIVER_TEMPLATE_SID?.trim();
  if (!customerPhoneTo) {
    summary.customerWhatsApp = "skipped";
    customerWhatsAppStatus = "SKIPPED_NO_CUSTOMER_PHONE";
    customerWhatsAppError = "SKIPPED_NO_CUSTOMER_PHONE";
    summary.detailMessages.push("Customer WhatsApp skipped: no customer phone available.");
  } else {
    const wa = await sendWhatsApp({
      to: customerPhoneTo,
      contentSid: customerTemplateSid,
      contentVariables: {
        "1": quote.assignedDriverName || "Not provided",
        "2": quote.assignedDriverPhone || "Not provided",
        "3": vehicleSummary(quote),
        "4": quote.pickupLocation || "See email",
        "5": quote.dropoffLocation || "See email",
        "6": formatJourneyDateTime(quote),
      },
    });

    if (wa.ok) {
      summary.customerWhatsApp = "sent";
      customerWhatsAppStatus = "SENT";
      customerWhatsAppSentAt = nowIso;
      customerWhatsAppError = undefined;
    } else if (wa.skipped) {
      summary.customerWhatsApp = "skipped";
      customerWhatsAppStatus = "SKIPPED";
      customerWhatsAppError = statusFromReason(wa.reason);
      summary.detailMessages.push(`Customer WhatsApp skipped: ${mapSkippedReason(wa.reason)}`);
    } else {
      summary.customerWhatsApp = "failed";
      customerWhatsAppStatus = "FAILED";
      customerWhatsAppError = statusFromReason(wa.reason);
      summary.detailMessages.push(`Customer WhatsApp failed: ${customerWhatsAppError}`);

      if (process.env.TWILIO_FROM_NUMBER?.trim()) {
        summary.customerSmsAttempted = true;
        const smsFallback = await sendSms({
          to: customerPhoneTo,
          body: `NI Taxi Co: Your driver is ${quote.assignedDriverName}. Driver phone: ${quote.assignedDriverPhone}. Journey: ${formatJourneyDateTime(quote)}.`,
        });
        if (smsFallback.ok) {
          summary.customerSms = "sent";
          customerDriverSmsSentAt = nowIso;
        } else if (smsFallback.skipped) {
          summary.customerSms = "skipped";
          summary.detailMessages.push(`Customer SMS skipped: ${mapSkippedReason(smsFallback.reason)}`);
        } else {
          summary.customerSms = "failed";
          summary.detailMessages.push(`Customer SMS failed: ${smsFallback.error || "Unknown error"}`);
        }
      }
    }
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

  const driverTemplateSid = process.env.TWILIO_WHATSAPP_DRIVER_JOB_TEMPLATE_SID?.trim();
  if (!driverPhoneTo) {
    summary.driverWhatsApp = "skipped";
    driverWhatsAppStatus = "SKIPPED_NO_DRIVER_PHONE";
    driverWhatsAppError = "SKIPPED_NO_DRIVER_PHONE";
    summary.detailMessages.push("Driver WhatsApp skipped: no driver phone available.");
  } else {
    const wa = await sendWhatsApp({
      to: driverPhoneTo,
      contentSid: driverTemplateSid,
      contentVariables: {
        "1": formatJourneyDateTime(quote),
        "2": quote.pickupLocation || "See email",
        "3": quote.dropoffLocation || "See email",
        "4": quote.guestName || quote.passengerName || "Not provided",
        "5": quote.guestPhone || quote.passengerPhone || "Not provided",
      },
    });

    if (wa.ok) {
      summary.driverWhatsApp = "sent";
      driverWhatsAppStatus = "SENT";
      driverWhatsAppSentAt = nowIso;
      driverWhatsAppError = undefined;
    } else if (wa.skipped) {
      summary.driverWhatsApp = "skipped";
      driverWhatsAppStatus = "SKIPPED";
      driverWhatsAppError = statusFromReason(wa.reason);
      summary.detailMessages.push(`Driver WhatsApp skipped: ${mapSkippedReason(wa.reason)}`);
    } else {
      summary.driverWhatsApp = "failed";
      driverWhatsAppStatus = "FAILED";
      driverWhatsAppError = statusFromReason(wa.reason);
      summary.detailMessages.push(`Driver WhatsApp failed: ${driverWhatsAppError}`);

      if (process.env.TWILIO_FROM_NUMBER?.trim()) {
        summary.driverSmsAttempted = true;
        const smsFallback = await sendSms({
          to: driverPhoneTo,
          body: `NI Taxi Co job: ${formatJourneyDateTime(quote)}. Pickup ${quote.pickupLocation}. Drop-off ${quote.dropoffLocation}. Check email for full details.`,
        });
        if (smsFallback.ok) {
          summary.driverSms = "sent";
          driverJobSmsSentAt = nowIso;
        } else if (smsFallback.skipped) {
          summary.driverSms = "skipped";
          summary.detailMessages.push(`Driver SMS skipped: ${mapSkippedReason(smsFallback.reason)}`);
        } else {
          summary.driverSms = "failed";
          summary.detailMessages.push(`Driver SMS failed: ${smsFallback.error || "Unknown error"}`);
        }
      }
    }
  }

  const requiredSentCount = [summary.customerEmail, summary.driverEmail].filter((s) => s === "sent").length;
  const requiredFailedCount = [summary.customerEmail, summary.driverEmail].filter((s) => s === "failed").length;
  const optionalFailures = [summary.customerWhatsApp, summary.driverWhatsApp, summary.customerSms, summary.driverSms].includes("failed");

  let assignmentStatus: "DETAILS_SENT" | "PARTIALLY_SENT" | "FAILED_TO_SEND" = "DETAILS_SENT";
  if (requiredFailedCount === 2) {
    assignmentStatus = "FAILED_TO_SEND";
  } else if (requiredSentCount >= 1 && (requiredFailedCount > 0 || optionalFailures)) {
    assignmentStatus = "PARTIALLY_SENT";
  }

  const updated = await db.updateQuote(id, {
    assignmentStatus,
    driverDetailsSentAt: summary.customerEmail === "sent" ? nowIso : undefined,
    driverJobSentAt: summary.driverEmail === "sent" ? nowIso : undefined,
    customerDriverEmailSentAt,
    customerDriverSmsSentAt: customerDriverSmsSentAt || undefined,
    driverJobEmailSentAt,
    driverJobSmsSentAt: driverJobSmsSentAt || undefined,
    customerWhatsAppSentAt: customerWhatsAppSentAt || undefined,
    driverWhatsAppSentAt: driverWhatsAppSentAt || undefined,
    customerWhatsAppStatus,
    driverWhatsAppStatus,
    customerWhatsAppError,
    driverWhatsAppError,
    lastCommunicationError: summary.detailMessages.length ? summary.detailMessages.join(" | ").slice(0, 1000) : undefined,
  });

  const topLevelMessage = assignmentStatus === "DETAILS_SENT"
    ? "Required emails sent. WhatsApp results are shown below."
    : assignmentStatus === "PARTIALLY_SENT"
      ? "Partially sent. Required emails delivered, but some channels had issues."
      : "Required emails failed. Please review below.";

  return NextResponse.json({
    success: true,
    message: topLevelMessage,
    notificationSummary: summary,
    quote: updated,
  });
}
