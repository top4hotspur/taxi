export const ROLES = ["guest", "customer", "admin", "driver"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_TYPES = ["PERSONAL", "BUSINESS"] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

export const QUOTE_STATUSES = [
  "SUBMITTED",
  "AWAITING_CONFIRMATION",
  "QUOTED",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
] as const;

export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];

export function normalizeQuoteStatus(value: string): QuoteStatusValue {
  switch (value) {
    case "SUBMITTED":
    case "QUOTE_REQUESTED":
      return "SUBMITTED";
    case "AWAITING_CONFIRMATION":
    case "QUOTE_UPDATED":
      return "AWAITING_CONFIRMATION";
    case "QUOTED":
    case "QUOTE_SENT":
      return "QUOTED";
    case "ACCEPTED":
    case "QUOTE_ACCEPTED":
    case "BOOKING_CREATED":
    case "BOOKING_CONFIRMED":
      return "ACCEPTED";
    case "DECLINED":
    case "QUOTE_DECLINED":
    case "QUOTE_IGNORED":
      return "DECLINED";
    case "CANCELLED":
    case "BOOKING_CANCELLED":
      return "CANCELLED";
    default:
      return "AWAITING_CONFIRMATION";
  }
}

export function getQuoteStatusLabel(value: string) {
  const normalized = normalizeQuoteStatus(value);
  switch (normalized) {
    case "SUBMITTED":
      return "Submitted";
    case "AWAITING_CONFIRMATION":
      return "Awaiting confirmation";
    case "QUOTED":
      return "Quoted";
    case "ACCEPTED":
      return "Accepted";
    case "DECLINED":
      return "Declined";
    case "CANCELLED":
      return "Cancelled";
    default:
      return normalized;
  }
}
