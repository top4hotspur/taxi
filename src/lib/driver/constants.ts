export const DRIVER_STATUSES = ["PENDING", "INCOMPLETE", "ACTIVE", "SUSPENDED"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_DOCUMENT_TYPES = [
  "TAXI_LICENCE",
  "TAXI_CAR_LICENCE",
  "INSURANCE",
  "DRIVING_LICENCE",
] as const;
export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];

export const DRIVER_DOCUMENT_STATUSES = ["MISSING", "UPLOADED", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type DriverDocumentStatus = (typeof DRIVER_DOCUMENT_STATUSES)[number];
