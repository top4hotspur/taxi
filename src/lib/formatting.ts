export function formatUkDateTime(value?: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

export function formatUkDateTimeFromParts(datePart?: string | null, timePart?: string | null): string {
  if (!datePart) return "Not provided";
  const iso = `${datePart}T${timePart || "00:00"}:00`;
  return formatUkDateTime(iso);
}

export function formatMoney(amount?: number | null, currency = "GBP"): string {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return "Not provided";
  return `${currency} ${amount.toFixed(2)}`;
}

export function meaningfullyProvided(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return normalized !== "account customer";
}
