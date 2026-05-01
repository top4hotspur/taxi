export interface FareEstimateInput {
  distanceMiles: number;
  durationMinutes: number;
  serviceType: string;
  passengers?: number;
  luggage?: string;
  golfBags?: number;
  itineraryMessage?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
}

export interface FareBreakdown {
  baseFare: number;
  mileageComponent: number;
  timeComponent: number;
  minimumFareApplied: boolean;
  airportUpliftPlaceholder: number;
  luggageSurchargePlaceholder: number;
}

export interface FareEstimateResult {
  estimatedFare: number;
  currency: "GBP";
  fareBreakdown: FareBreakdown;
  requiresManualReview: boolean;
}

const FARE_CONFIG = {
  baseFare: 10,
  perMile: 2.2,
  perMinute: 0.35,
  minimumFare: 25,
  currency: "GBP" as const,
};

function detectManualReviewNeeded(input: FareEstimateInput) {
  const service = input.serviceType.toLowerCase();
  const message = (input.itineraryMessage || "").toLowerCase();

  if (service.includes("tour") || service.includes("event")) return true;
  if (service.includes("golf") && (input.golfBags || 0) >= 4) return true;

  const multiStopHints = ["multi-stop", "multiple stops", "several stops", "stop at", "via", "itinerary", "tour"];
  return multiStopHints.some((hint) => message.includes(hint));
}

export function estimateFare(input: FareEstimateInput): FareEstimateResult {
  const baseFare = FARE_CONFIG.baseFare;
  const mileageComponent = Number((Math.max(input.distanceMiles, 0) * FARE_CONFIG.perMile).toFixed(2));
  const timeComponent = Number((Math.max(input.durationMinutes, 0) * FARE_CONFIG.perMinute).toFixed(2));
  const airportUpliftPlaceholder = 0;
  const luggageSurchargePlaceholder = 0;

  const rawFare = baseFare + mileageComponent + timeComponent + airportUpliftPlaceholder + luggageSurchargePlaceholder;
  const minimumFareApplied = rawFare < FARE_CONFIG.minimumFare;
  const estimatedFare = Number((minimumFareApplied ? FARE_CONFIG.minimumFare : rawFare).toFixed(2));

  return {
    estimatedFare,
    currency: FARE_CONFIG.currency,
    fareBreakdown: {
      baseFare,
      mileageComponent,
      timeComponent,
      minimumFareApplied,
      airportUpliftPlaceholder,
      luggageSurchargePlaceholder,
    },
    requiresManualReview: detectManualReviewNeeded(input),
  };
}
