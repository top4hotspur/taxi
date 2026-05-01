export interface RouteEstimateInput {
  pickupPlaceId?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffPlaceId?: string;
  dropoffLat?: number;
  dropoffLng?: number;
}

export interface RouteEstimateResult {
  distanceMeters: number;
  durationSeconds: number;
  distanceMiles: number;
  durationMinutes: number;
  routeSummary?: string;
}

export class RoutesApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RoutesApiError";
    this.code = code;
  }
}

function toWaypoint(placeId?: string, lat?: number, lng?: number) {
  if (placeId) {
    return { placeId };
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      location: {
        latLng: {
          latitude: lat,
          longitude: lng,
        },
      },
    };
  }

  return null;
}

function parseDurationSeconds(duration: string | undefined) {
  if (!duration) return 0;
  const value = Number(duration.replace("s", ""));
  return Number.isFinite(value) ? value : 0;
}

export async function computeRouteEstimate(input: RouteEstimateInput): Promise<RouteEstimateResult> {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey) {
    throw new RoutesApiError("ROUTES_CONFIG_MISSING", "Google Routes API key is not configured.");
  }

  const origin = toWaypoint(input.pickupPlaceId, input.pickupLat, input.pickupLng);
  const destination = toWaypoint(input.dropoffPlaceId, input.dropoffLat, input.dropoffLng);

  if (!origin || !destination) {
    throw new RoutesApiError("ROUTES_INPUT_INVALID", "Pickup/drop-off coordinates or place IDs are required.");
  }

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.description",
    },
    body: JSON.stringify({
      origin,
      destination,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-GB",
      units: "IMPERIAL",
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: { routes?: Array<{ distanceMeters?: number; duration?: string; description?: string }>; error?: { message?: string } } = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      parsed = {};
    }
  }

  if (!response.ok) {
    throw new RoutesApiError(
      "ROUTES_API_FAILED",
      parsed.error?.message || `Google Routes API request failed with status ${response.status}.`
    );
  }

  const route = parsed.routes?.[0];
  if (!route || !Number.isFinite(route.distanceMeters)) {
    throw new RoutesApiError("ROUTES_NOT_FOUND", "No valid route returned for this journey.");
  }

  const distanceMeters = Number(route.distanceMeters);
  const durationSeconds = parseDurationSeconds(route.duration);
  const distanceMiles = Number((distanceMeters / 1609.344).toFixed(2));
  const durationMinutes = Number((durationSeconds / 60).toFixed(1));

  return {
    distanceMeters,
    durationSeconds,
    distanceMiles,
    durationMinutes,
    routeSummary: route.description,
  };
}
