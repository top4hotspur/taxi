import type { PricingDateUpliftRecord, PricingSettingsRecord, PricingTimeUpliftRecord } from "@/lib/db";

export interface FareEstimateInput {
  distanceMiles: number;
  durationMinutes: number;
  serviceType: string;
  pickupDate?: string;
  pickupTime?: string;
  passengers?: number;
  oversizeItemCount?: number;
  itineraryMessage?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
}

export interface FareBreakdown {
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  minimumFareApplied: boolean;
  timeUpliftPercent: number;
  timeUpliftAmount: number;
  dateUpliftPercent: number;
  dateUpliftAmount: number;
  airportSurchargeApplied: boolean;
  airportSurchargeAmount: number;
  passengerBand: "1-4" | "5-6" | "7-8" | "8+";
  passengerUpliftPercent: number;
  passengerUpliftAmount: number;
  oversizeSurchargePlaceholder: number;
  finalEstimatedFare: number;
  currency: string;
}

export interface FareEstimateResult {
  estimatedFare: number;
  currency: string;
  fareBreakdown: FareBreakdown;
  requiresManualReview: boolean;
}

function detectManualReviewNeeded(input: FareEstimateInput) {
  const service = input.serviceType.toLowerCase();
  const message = (input.itineraryMessage || "").toLowerCase();
  if (service.includes("tour") || service.includes("event")) return true;
  if (service.includes("golf") && (input.oversizeItemCount || 0) >= 4) return true;
  const multiStopHints = ["multi-stop", "multiple stops", "several stops", "stop at", "via", "itinerary", "tour"];
  return multiStopHints.some((hint) => message.includes(hint));
}

function timeToMinutes(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function appliesTimeBand(pickupTime: string | undefined, band: PricingTimeUpliftRecord) {
  const pickup = timeToMinutes(pickupTime);
  const start = timeToMinutes(band.startTime);
  const end = timeToMinutes(band.endTime);
  if (pickup === null || start === null || end === null) return false;
  if (start <= end) return pickup >= start && pickup <= end;
  return pickup >= start || pickup <= end;
}

function appliesDateRule(pickupDate: string | undefined, rule: PricingDateUpliftRecord) {
  if (!pickupDate) return false;
  if (rule.ruleType === "SINGLE_DATE") return Boolean(rule.date && rule.date === pickupDate);
  if (rule.ruleType === "DATE_RANGE") return Boolean(rule.startDate && rule.endDate && pickupDate >= rule.startDate && pickupDate <= rule.endDate);
  if (rule.ruleType === "RECURRING_ANNUAL_DATE") return Boolean(rule.date && pickupDate.slice(5) === rule.date.slice(5));
  return false;
}

function computeTimeUpliftPercent(pickupTime: string | undefined, rules: PricingTimeUpliftRecord[]) {
  const matched = rules.find((rule) => rule.active && appliesTimeBand(pickupTime, rule));
  return matched ? matched.upliftPercent : 0;
}

function computeDateUpliftPercent(pickupDate: string | undefined, rules: PricingDateUpliftRecord[]) {
  const matched = rules.find((rule) => rule.active && appliesDateRule(pickupDate, rule));
  return matched ? matched.upliftPercent : 0;
}

function isAirportJourney(pickupLocation?: string, dropoffLocation?: string) {
  const text = `${pickupLocation || ""} ${dropoffLocation || ""}`.toLowerCase();
  return text.includes("airport");
}

function getPassengerBand(passengers: number | undefined) {
  const count = passengers || 1;
  if (count <= 4) return "1-4" as const;
  if (count <= 6) return "5-6" as const;
  if (count <= 8) return "7-8" as const;
  return "8+" as const;
}

function getPassengerUpliftPercent(settings: PricingSettingsRecord, passengers: number | undefined) {
  const band = getPassengerBand(passengers);
  if (band === "5-6") return settings.passengerBand_5_6_UpliftPercent || 0;
  if (band === "7-8") return settings.passengerBand_7_8_UpliftPercent || 0;
  return 0;
}

export function estimateFare(
  input: FareEstimateInput,
  settings: PricingSettingsRecord,
  timeUplifts: PricingTimeUpliftRecord[],
  dateUplifts: PricingDateUpliftRecord[]
): FareEstimateResult {
  const baseFare = settings.baseFare;
  const distanceCharge = Number((Math.max(input.distanceMiles, 0) * settings.perMile).toFixed(2));
  const timeCharge = Number((Math.max(input.durationMinutes, 0) * settings.perMinute).toFixed(2));
  const preMinimum = baseFare + distanceCharge + timeCharge;
  const minimumFareApplied = preMinimum < settings.minimumFare;
  const minimumAppliedFare = minimumFareApplied ? settings.minimumFare : preMinimum;
  const timeUpliftPercent = computeTimeUpliftPercent(input.pickupTime, timeUplifts);
  const timeUpliftAmount = Number(((minimumAppliedFare * timeUpliftPercent) / 100).toFixed(2));
  const dateUpliftPercent = computeDateUpliftPercent(input.pickupDate, dateUplifts);
  const dateUpliftAmount = Number((((minimumAppliedFare + timeUpliftAmount) * dateUpliftPercent) / 100).toFixed(2));
  const airportSurchargeApplied = isAirportJourney(input.pickupLocation, input.dropoffLocation);
  const airportSurchargeAmount = airportSurchargeApplied ? Number(settings.airportSurchargeAmount || 5) : 0;
  const passengerBand = getPassengerBand(input.passengers);
  const passengerUpliftPercent = getPassengerUpliftPercent(settings, input.passengers);
  const passengerUpliftBase = minimumAppliedFare + timeUpliftAmount + dateUpliftAmount + airportSurchargeAmount;
  const passengerUpliftAmount = Number(((passengerUpliftBase * passengerUpliftPercent) / 100).toFixed(2));
  const oversizeSurchargePlaceholder = 0;
  const finalEstimatedFare = Number(
    (minimumAppliedFare + timeUpliftAmount + dateUpliftAmount + airportSurchargeAmount + passengerUpliftAmount + oversizeSurchargePlaceholder).toFixed(2)
  );

  return {
    estimatedFare: finalEstimatedFare,
    currency: settings.currency || "GBP",
    fareBreakdown: {
      baseFare,
      distanceCharge,
      timeCharge,
      minimumFareApplied,
      timeUpliftPercent,
      timeUpliftAmount,
      dateUpliftPercent,
      dateUpliftAmount,
      airportSurchargeApplied,
      airportSurchargeAmount,
      passengerBand,
      passengerUpliftPercent,
      passengerUpliftAmount,
      oversizeSurchargePlaceholder,
      finalEstimatedFare,
      currency: settings.currency || "GBP",
    },
    requiresManualReview: detectManualReviewNeeded(input),
  };
}
