import type { AccountTypeValue, QuoteStatusValue } from "@/lib/quote/constants";
import { db, type QuoteRecord } from "@/lib/db";
import { sendEmail, type EmailResult } from "@/lib/email/sendEmail";
import {
  adminQuoteRequestedEmail,
  customerQuoteRequestedEmail,
  customerQuoteUpdatedEmail,
  customerQuoteSentEmail,
  customerQuoteAcceptedEmail,
  adminQuoteAcceptedEmail,
  adminQuoteDeclinedEmail,
  adminBookingCreatedEmail,
  customerBookingConfirmedEmail,
  adminBookingConfirmedEmail,
} from "@/lib/email/templates";

const adminEmail = process.env.ADMIN_EMAIL || "";

export interface CreateQuoteInput {
  customerId?: string;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  accountType: AccountTypeValue;
  serviceType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  passengers: number;
  luggage?: string;
  golfBags?: number;
  returnJourney: boolean;
  itineraryMessage?: string;
}

export interface QuoteNotificationOutcome {
  requesterEmail: EmailResult;
  adminEmail: EmailResult;
}

export async function resolveQuoteRecipient(quote: QuoteRecord): Promise<{ email?: string; isGuest: boolean }> {
  if (quote.guestEmail) return { email: quote.guestEmail, isGuest: true };
  if (!quote.customerId) return { isGuest: true };
  const user = await db.findUserById(quote.customerId);
  return { email: user?.email, isGuest: false };
}

async function maybeAdminEmail(subject: string, text: string): Promise<EmailResult> {
  if (!adminEmail) {
    return { ok: false, skipped: true, error: "ADMIN_EMAIL not set" };
  }
  return sendEmail({ to: adminEmail, subject, text });
}

export async function createQuote(input: CreateQuoteInput) {
  const quote = await db.createQuote({
    customerId: input.customerId,
    guestEmail: input.guestEmail,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    accountType: input.accountType,
    serviceType: input.serviceType,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    passengers: input.passengers,
    luggage: input.luggage,
    golfBags: input.golfBags ?? 0,
    returnJourney: input.returnJourney,
    itineraryMessage: input.itineraryMessage,
    quotedCurrency: "GBP",
    status: "QUOTE_REQUESTED",
  });

  await db.createAudit({
    quoteId: quote.id,
    changedByRole: input.customerId ? "customer" : "guest",
    changedByUserId: input.customerId,
    previousStatus: undefined,
    newStatus: "QUOTE_REQUESTED",
    note: "Quote created",
  });

  const recipient = await resolveQuoteRecipient(quote);
  let requesterEmail: EmailResult = { ok: false, skipped: true, error: "No recipient email" };

  if (recipient.email) {
    const requesterTemplate = customerQuoteRequestedEmail({ quote, isGuest: recipient.isGuest, recipientName: quote.guestName });
    requesterEmail = await sendEmail({ to: recipient.email, subject: requesterTemplate.subject, text: requesterTemplate.text });
  }

  const adminTemplate = adminQuoteRequestedEmail({ quote, requesterEmail: recipient.email });
  const adminResult = await maybeAdminEmail(adminTemplate.subject, adminTemplate.text);

  return { quote, email: { requesterEmail, adminEmail: adminResult } };
}

export async function updateQuoteStatusAudit(params: {
  quoteId: string;
  changedByRole: string;
  changedByUserId?: string;
  previousStatus?: string;
  newStatus: QuoteStatusValue;
  note?: string;
}) {
  return db.createAudit({
    quoteId: params.quoteId,
    changedByRole: params.changedByRole,
    changedByUserId: params.changedByUserId,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    note: params.note,
  });
}

export async function sendStatusLifecycleEmails(args: {
  quote: QuoteRecord;
  newStatus: QuoteStatusValue;
}) {
  const { quote, newStatus } = args;
  const recipient = await resolveQuoteRecipient(quote);

  if (newStatus === "QUOTE_UPDATED" && recipient.email) {
    const t = customerQuoteUpdatedEmail(quote, recipient.isGuest);
    await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
  }

  if (newStatus === "QUOTE_SENT" && recipient.email) {
    const t = customerQuoteSentEmail(quote, recipient.isGuest);
    await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
  }

  if (newStatus === "QUOTE_ACCEPTED") {
    if (recipient.email) {
      const t = customerQuoteAcceptedEmail(quote, recipient.isGuest);
      await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
    }
    const adminT = adminQuoteAcceptedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }

  if (newStatus === "QUOTE_DECLINED") {
    const adminT = adminQuoteDeclinedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }

  if (newStatus === "BOOKING_CREATED") {
    const adminT = adminBookingCreatedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }

  if (newStatus === "BOOKING_CONFIRMED") {
    if (recipient.email) {
      const t = customerBookingConfirmedEmail(quote, recipient.isGuest);
      await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
    }
    const adminT = adminBookingConfirmedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }
}
