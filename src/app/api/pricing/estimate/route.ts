import { NextResponse } from "next/server";
import { estimateFare } from "@/lib/pricing/fare";
import { computeRouteEstimate, RoutesApiError } from "@/lib/pricing/routes";
import { getEffectivePricingConfig } from "@/lib/pricing/settings";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;

    const pickupLat = Number(body.pickupLat);
    const pickupLng = Number(body.pickupLng);
    const dropoffLat = Number(body.dropoffLat);
    const dropoffLng = Number(body.dropoffLng);
    const passengers = Number(body.passengers || 1);
    const golfBags = Number(body.golfBags || 0);
    const pickupDate = String(body.pickupDate || "");
    const pickupTime = String(body.pickupTime || "");

    const pickupLocation = String(body.pickupLocation || "").trim();
    const dropoffLocation = String(body.dropoffLocation || "").trim();
    if (!pickupLocation || !dropoffLocation) {
      return NextResponse.json(
        {
          ok: true,
          estimatedFare: null,
          currency: "GBP",
          distanceMiles: null,
          durationMinutes: null,
          fareBreakdown: null,
          pricingSource: "FALLBACK_MANUAL_REVIEW",
          requiresManualReview: true,
          routeEstimateFailed: true,
          routeEstimateFailureReason: "Route details were incomplete.",
          customerMessage: "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.",
          errorCode: "ROUTES_INPUT_INVALID",
        },
        { status: 200 }
      );
    }

    const route = await computeRouteEstimate({
      pickupPlaceId: String(body.pickupPlaceId || "") || undefined,
      pickupLat: Number.isFinite(pickupLat) ? pickupLat : undefined,
      pickupLng: Number.isFinite(pickupLng) ? pickupLng : undefined,
      dropoffPlaceId: String(body.dropoffPlaceId || "") || undefined,
      dropoffLat: Number.isFinite(dropoffLat) ? dropoffLat : undefined,
      dropoffLng: Number.isFinite(dropoffLng) ? dropoffLng : undefined,
    });

    const pricingConfig = await getEffectivePricingConfig();
    const fare = estimateFare({
      distanceMiles: route.distanceMiles,
      durationMinutes: route.durationMinutes,
      serviceType: String(body.serviceType || ""),
      pickupDate,
      pickupTime,
      passengers: Number.isFinite(passengers) ? passengers : undefined,
      luggage: String(body.luggage || ""),
      golfBags: Number.isFinite(golfBags) ? golfBags : undefined,
      itineraryMessage: String(body.itineraryMessage || ""),
      pickupLocation: String(body.pickupLocation || ""),
      dropoffLocation: String(body.dropoffLocation || ""),
    }, pricingConfig.settings, pricingConfig.timeUplifts, pricingConfig.dateUplifts);

    return NextResponse.json({
      ok: true,
      estimatedFare: fare.estimatedFare,
      currency: fare.currency,
      distanceMiles: route.distanceMiles,
      durationMinutes: route.durationMinutes,
      fareBreakdown: fare.fareBreakdown,
      pricingSource: "GOOGLE_ROUTES",
      requiresManualReview: fare.requiresManualReview,
      routeEstimateFailed: false,
      routeEstimateFailureReason: null,
      routeSummary: route.routeSummary || null,
    });
  } catch (error) {
    const code = error instanceof RoutesApiError ? error.code : "PRICING_ESTIMATE_FAILED";
    console.error(
      JSON.stringify({
        level: "error",
        source: "api.pricing.estimate",
        errorCode: code,
        message: error instanceof Error ? error.message : "Unknown pricing error",
        pickupLocation: String(body.pickupLocation || ""),
        dropoffLocation: String(body.dropoffLocation || ""),
      })
    );

    if (error instanceof RoutesApiError) {
      return NextResponse.json(
        {
          ok: true,
          estimatedFare: null,
          currency: "GBP",
          distanceMiles: null,
          durationMinutes: null,
          fareBreakdown: null,
          pricingSource: "FALLBACK_MANUAL_REVIEW",
          requiresManualReview: true,
          routeEstimateFailed: true,
          routeEstimateFailureReason:
            error.code === "ROUTES_CONFIG_MISSING"
              ? "Automatic route pricing is temporarily unavailable."
              : "Route estimate could not be calculated automatically.",
          customerMessage: "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.",
          errorCode: error.code,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        estimatedFare: null,
        currency: "GBP",
        distanceMiles: null,
        durationMinutes: null,
        fareBreakdown: null,
        pricingSource: "FALLBACK_MANUAL_REVIEW",
        requiresManualReview: true,
        routeEstimateFailed: true,
        routeEstimateFailureReason: "Automatic route pricing is temporarily unavailable.",
        customerMessage: "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.",
        errorCode: "PRICING_ESTIMATE_FAILED",
      },
      { status: 200 }
    );
  }
}
