import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { customerDriverDetailsEmail, driverJobDetailsEmail } from "@/lib/email/templates";
import { sendSms } from "@/lib/notifications/sms";

type ChannelResult = "sent" | "skipped" | "failed";

type NotificationSummary = {
  customerEmail: ChannelResult;
  customerSms: ChannelResult;
  driverEmail: ChannelResult;
  driverSms: ChannelResult;
  detailMessages: string[];
};

function formatJourneyShort(quote: Awaited<ReturnType<typeof db.findQuoteById>>) {
  if (!quote) return "";
  return `${quote.pickupDate} ${quote.pickupTime} ${quote.pickupLocation} -> ${quote.dropoffLocation}`;
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
    customerSms: "skipped",
    driverEmail: "skipped",
    driverSms: "skipped",
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
    const sms = await sendSms({
      to: customerPhoneTo,
      message: `NI Taxi Co: Your driver is ${quote.assignedDriverName}, ${quote.assignedVehicleColour || ""} ${quote.assignedVehicleMake || "vehicle"} reg ${quote.assignedVehicleRegistration || "TBC"}. Driver phone: ${quote.assignedDriverPhone}. Journey: ${formatJourneyShort(quote)}.`,
    });
    if (sms.ok) {
      summary.customerSms = "sent";
      customerDriverSmsSentAt = nowIso;
    } else if (sms.skipped) {
      summary.customerSms = "skipped";
      summary.detailMessages.push(`Customer SMS skipped: ${sms.reason || "Not configured"}`);
    } else {
      summary.customerSms = "failed";
      summary.detailMessages.push(`Customer SMS failed: ${sms.error || "Unknown error"}`);
    }
  } else {
    summary.customerSms = "skipped";
    summary.detailMessages.push("Customer SMS skipped: no customer phone available.");
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
    const sms = await sendSms({
      to: driverPhoneTo,
      message: `NI Taxi Co job: ${quote.pickupDate} ${quote.pickupTime}. Pickup ${quote.pickupLocation}. Drop-off ${quote.dropoffLocation}. Passenger: ${(quote.guestName || quote.passengerName || "Customer")} ${quote.guestPhone || quote.passengerPhone || ""}. Check email/admin for full details.`,
    });
    if (sms.ok) {
      summary.driverSms = "sent";
      driverJobSmsSentAt = nowIso;
    } else if (sms.skipped) {
      summary.driverSms = "skipped";
      summary.detailMessages.push(`Driver SMS skipped: ${sms.reason || "Not configured"}`);
    } else {
      summary.driverSms = "failed";
      summary.detailMessages.push(`Driver SMS failed: ${sms.error || "Unknown error"}`);
    }
  } else {
    summary.driverSms = "skipped";
    summary.detailMessages.push("Driver SMS skipped: no driver phone available.");
  }

  const anyFailed = [summary.customerEmail, summary.customerSms, summary.driverEmail, summary.driverSms].includes("failed");
  const allSent = [summary.customerEmail, summary.customerSms, summary.driverEmail, summary.driverSms].every((v) => v === "sent");

  const updated = await db.updateQuote(id, {
    assignmentStatus: anyFailed ? "FAILED_TO_SEND" : "DETAILS_SENT",
    driverDetailsSentAt: (summary.customerEmail === "sent" || summary.customerSms === "sent") ? nowIso : quote.driverDetailsSentAt,
    driverJobSentAt: (summary.driverEmail === "sent" || summary.driverSms === "sent") ? nowIso : quote.driverJobSentAt,
    customerDriverEmailSentAt: customerDriverEmailSentAt || quote.customerDriverEmailSentAt,
    customerDriverSmsSentAt: customerDriverSmsSentAt || quote.customerDriverSmsSentAt,
    driverJobEmailSentAt: driverJobEmailSentAt || quote.driverJobEmailSentAt,
    driverJobSmsSentAt: driverJobSmsSentAt || quote.driverJobSmsSentAt,
    lastCommunicationError: anyFailed ? summary.detailMessages.join(" | ").slice(0, 1000) : undefined,
  });

  const topLevelMessage = allSent
    ? "Driver and customer details sent."
    : anyFailed
      ? "Some messages could not be sent. Please review below."
      : "Notifications processed.";

  return NextResponse.json({
    success: true,
    message: topLevelMessage,
    notificationSummary: summary,
    quote: updated,
  });
}
