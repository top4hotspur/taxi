import { QuoteRecord } from "@/lib/db";

const siteUrl = process.env.SITE_URL || "https://www.nitaxico.com";

function quoteSummary(quote: QuoteRecord) {
  return [
    `Quote ID: ${quote.id}`,
    `Service: ${quote.serviceType}`,
    `Route: ${quote.pickupLocation} -> ${quote.dropoffLocation}`,
    `Date/Time: ${quote.pickupDate} ${quote.pickupTime}`,
    `Passengers: ${quote.passengers}`,
    `Luggage: ${quote.luggage || "N/A"}`,
    `Golf bags: ${quote.golfBags ?? 0}`,
    `Return journey: ${quote.returnJourney ? "Yes" : "No"}`,
    `Status: ${quote.status}`,
  ].join("\n");
}

export function customerQuoteRequestedEmail(params: { quote: QuoteRecord; recipientName?: string; isGuest: boolean }) {
  const intro = params.isGuest
    ? "Thank you for your quote request. We have received your details and will respond shortly."
    : "Thank you for your quote request. It has been saved to your account and our team will respond shortly.";
  const guestGuidance = params.isGuest
    ? "\nReply to this email or create an account using the same email to track your request."
    : `\nYou can track this quote in your account: ${siteUrl}/account/quotes/${params.quote.id}`;

  return {
    subject: `Quote request received (${params.quote.id})`,
    text: `${intro}\n\n${quoteSummary(params.quote)}${guestGuidance}\n\nNI Taxi Co`,
  };
}

export function adminQuoteRequestedEmail(params: { quote: QuoteRecord; requesterEmail?: string }) {
  return {
    subject: `New quote request: ${params.quote.id}`,
    text: `A new quote request was submitted.${params.requesterEmail ? `\nRequester email: ${params.requesterEmail}` : ""}\n\n${quoteSummary(params.quote)}`,
  };
}

export function customerQuoteUpdatedEmail(quote: QuoteRecord, isGuest: boolean) {
  const trackText = isGuest
    ? "Reply to this email if you need changes to your request."
    : `Track your quote: ${siteUrl}/account/quotes/${quote.id}`;
  return {
    subject: `Your quote was updated (${quote.id})`,
    text: `Your quote has been updated.\n\n${quoteSummary(quote)}\n\n${trackText}`,
  };
}

export function customerQuoteSentEmail(quote: QuoteRecord, isGuest: boolean) {
  const priceLine = quote.quotedPrice !== undefined ? `Quoted price: ${quote.quotedCurrency} ${quote.quotedPrice}` : "Quoted price: Pending";
  const cta = isGuest
    ? "Reply to this email to accept or decline, or create an account using the same email to track your request."
    : `Review and respond here: ${siteUrl}/account/quotes/${quote.id}`;
  return {
    subject: `Your quote is ready (${quote.id})`,
    text: `Your quote is ready.\n${priceLine}\n\n${quoteSummary(quote)}\n\n${cta}`,
  };
}

export function customerQuoteAcceptedEmail(quote: QuoteRecord, isGuest: boolean) {
  const track = isGuest ? "We will follow up by email with next steps." : `Track progress: ${siteUrl}/account/quotes/${quote.id}`;
  return {
    subject: `Quote accepted (${quote.id})`,
    text: `Thank you for accepting your quote.\n\n${quoteSummary(quote)}\n\n${track}`,
  };
}

export function adminQuoteAcceptedEmail(quote: QuoteRecord) {
  return {
    subject: `Quote accepted by customer (${quote.id})`,
    text: `A customer accepted quote ${quote.id}.\n\n${quoteSummary(quote)}`,
  };
}

export function adminQuoteDeclinedEmail(quote: QuoteRecord) {
  return {
    subject: `Quote declined by customer (${quote.id})`,
    text: `A customer declined quote ${quote.id}.\n\n${quoteSummary(quote)}`,
  };
}

export function adminBookingCreatedEmail(quote: QuoteRecord) {
  return {
    subject: `Booking created (${quote.id})`,
    text: `A booking has been created from quote ${quote.id}.\n\n${quoteSummary(quote)}`,
  };
}

export function customerBookingConfirmedEmail(quote: QuoteRecord, isGuest: boolean) {
  const track = isGuest ? "Reply to this email for any changes." : `View booking quote details: ${siteUrl}/account/quotes/${quote.id}`;
  return {
    subject: `Booking confirmed (${quote.id})`,
    text: `Your booking is confirmed.\n\nJourney summary:\n${quoteSummary(quote)}\n\nDriver details: To be shared before travel (placeholder).\n\n${track}`,
  };
}

export function adminBookingConfirmedEmail(quote: QuoteRecord) {
  return {
    subject: `Booking confirmed (${quote.id})`,
    text: `Booking confirmed for quote ${quote.id}.\n\n${quoteSummary(quote)}`,
  };
}
