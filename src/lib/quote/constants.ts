export const ROLES = ["guest", "customer", "admin", "driver"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_TYPES = ["PERSONAL", "BUSINESS"] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

export const QUOTE_STATUSES = [
  "QUOTE_REQUESTED",
  "QUOTE_UPDATED",
  "QUOTE_SENT",
  "QUOTE_ACCEPTED",
  "QUOTE_DECLINED",
  "QUOTE_IGNORED",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
] as const;

export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];
