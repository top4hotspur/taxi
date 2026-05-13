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
} from "@/lib/email/templates";

const adminEmail = process.env.ADMIN_EMAIL || "";

export interface CreateQuoteInput {
  correlationId?: string;
  customerId?: string;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  passengerName?: string;
  passengerPhone?: string;
  leadPassengerSameAsBooker?: boolean;
  leadPassengerName?: string;
  leadPassengerEmail?: string;
  leadPassengerPhone?: string;
  accountType: AccountTypeValue;
  serviceType: string;
  pickupLocation: string;
  pickupPlaceId?: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLocation: string;
  dropoffPlaceId?: string;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupDate: string;
  pickupTime: string;
  passengers: number;
  handLuggageCount?: number;
  suitcaseCount?: number;
  oversizeItemCount?: number;
  luggage?: string;
  golfBags?: number;
  returnJourney: boolean;
  returnJourneyNeeded?: boolean;
  returnPickup?: string;
  returnPickupPlaceId?: string;
  returnPickupAddress?: string;
  returnPickupLat?: number;
  returnPickupLng?: number;
  returnDropoff?: string;
  returnDropoffPlaceId?: string;
  returnDropoffAddress?: string;
  returnDropoffLat?: number;
  returnDropoffLng?: number;
  returnDate?: string;
  returnTime?: string;
  itineraryMessage?: string;
  estimatedFare?: number;
  finalEstimatedFare?: number;
  outwardEstimatedFare?: number;
  returnEstimatedFare?: number;
  returnDiscountPercent?: number;
  returnDiscountAmount?: number;
  estimatedCurrency?: string;
  estimatedDistanceMiles?: number;
  estimatedDurationMinutes?: number;
  estimatedFareBreakdown?: string;
  pricingSource?: string;
  requiresManualReview?: boolean;
  pricingCalculatedAt?: string;
  routeEstimateFailed?: boolean;
  routeEstimateFailureReason?: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  policyVersion?: string;
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
    passengerName: input.passengerName,
    passengerPhone: input.passengerPhone,
    leadPassengerSameAsBooker: input.leadPassengerSameAsBooker,
    leadPassengerName: input.leadPassengerName,
    leadPassengerEmail: input.leadPassengerEmail,
    leadPassengerPhone: input.leadPassengerPhone,
    accountType: input.accountType,
    serviceType: input.serviceType,
    pickupLocation: input.pickupLocation,
    pickupPlaceId: input.pickupPlaceId,
    pickupAddress: input.pickupAddress,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    dropoffLocation: input.dropoffLocation,
    dropoffPlaceId: input.dropoffPlaceId,
    dropoffAddress: input.dropoffAddress,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    passengers: input.passengers,
    handLuggageCount: input.handLuggageCount,
    suitcaseCount: input.suitcaseCount,
    oversizeItemCount: input.oversizeItemCount,
    luggage: input.luggage,
    golfBags: input.golfBags ?? 0,
    returnJourney: input.returnJourney,
    returnJourneyNeeded: input.returnJourneyNeeded,
    returnPickup: input.returnPickup,
    returnPickupPlaceId: input.returnPickupPlaceId,
    returnPickupAddress: input.returnPickupAddress,
    returnPickupLat: input.returnPickupLat,
    returnPickupLng: input.returnPickupLng,
    returnDropoff: input.returnDropoff,
    returnDropoffPlaceId: input.returnDropoffPlaceId,
    returnDropoffAddress: input.returnDropoffAddress,
    returnDropoffLat: input.returnDropoffLat,
    returnDropoffLng: input.returnDropoffLng,
    returnDate: input.returnDate,
    returnTime: input.returnTime,
    itineraryMessage: input.itineraryMessage,
    estimatedFare: input.estimatedFare,
    finalEstimatedFare: input.finalEstimatedFare,
    outwardEstimatedFare: input.outwardEstimatedFare,
    returnEstimatedFare: input.returnEstimatedFare,
    returnDiscountPercent: input.returnDiscountPercent,
    returnDiscountAmount: input.returnDiscountAmount,
    estimatedCurrency: input.estimatedCurrency,
    estimatedDistanceMiles: input.estimatedDistanceMiles,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    estimatedFareBreakdown: input.estimatedFareBreakdown,
    pricingSource: input.pricingSource,
    requiresManualReview: input.requiresManualReview,
    pricingCalculatedAt: input.pricingCalculatedAt,
    routeEstimateFailed: input.routeEstimateFailed,
    routeEstimateFailureReason: input.routeEstimateFailureReason,
    termsAccepted: input.termsAccepted,
    termsAcceptedAt: input.termsAcceptedAt,
    policyVersion: input.policyVersion,
    quotedCurrency: "GBP",
    confirmedCurrency: "GBP",
    paymentStatus: "NOT_REQUIRED",
    status: "SUBMITTED",
  }, { correlationId: input.correlationId });

  await db.createAudit({
    quoteId: quote.id,
    changedByRole: input.customerId ? "customer" : "guest",
    changedByUserId: input.customerId,
    previousStatus: undefined,
    newStatus: "SUBMITTED",
    note: "Quote created",
  }, { correlationId: input.correlationId });

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

  if (newStatus === "AWAITING_CONFIRMATION" && recipient.email) {
    const t = customerQuoteUpdatedEmail(quote, recipient.isGuest);
    await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
  }

  if (newStatus === "QUOTED" && recipient.email) {
    const t = customerQuoteSentEmail(quote, recipient.isGuest);
    await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
  }

  if (newStatus === "ACCEPTED") {
    if (recipient.email) {
      const t = customerQuoteAcceptedEmail(quote, recipient.isGuest);
      await sendEmail({ to: recipient.email, subject: t.subject, text: t.text });
    }
    const adminT = adminQuoteAcceptedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }

  if (newStatus === "DECLINED") {
    const adminT = adminQuoteDeclinedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }

  if (newStatus === "AWAITING_CONFIRMATION") {
    const adminT = adminBookingCreatedEmail(quote);
    await maybeAdminEmail(adminT.subject, adminT.text);
  }
}
