import { NextResponse } from "next/server";
import { estimateFare } from "@/lib/pricing/fare";
import { computeRouteEstimate, RoutesApiError } from "@/lib/pricing/routes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const pickupLat = Number(body.pickupLat);
    const pickupLng = Number(body.pickupLng);
    const dropoffLat = Number(body.dropoffLat);
    const dropoffLng = Number(body.dropoffLng);
    const passengers = Number(body.passengers || 1);
    const golfBags = Number(body.golfBags || 0);

    const route = await computeRouteEstimate({
      pickupPlaceId: String(body.pickupPlaceId || "") || undefined,
      pickupLat: Number.isFinite(pickupLat) ? pickupLat : undefined,
      pickupLng: Number.isFinite(pickupLng) ? pickupLng : undefined,
      dropoffPlaceId: String(body.dropoffPlaceId || "") || undefined,
      dropoffLat: Number.isFinite(dropoffLat) ? dropoffLat : undefined,
      dropoffLng: Number.isFinite(dropoffLng) ? dropoffLng : undefined,
    });

    const fare = estimateFare({
      distanceMiles: route.distanceMiles,
      durationMinutes: route.durationMinutes,
      serviceType: String(body.serviceType || ""),
      passengers: Number.isFinite(passengers) ? passengers : undefined,
      luggage: String(body.luggage || ""),
      golfBags: Number.isFinite(golfBags) ? golfBags : undefined,
      itineraryMessage: String(body.itineraryMessage || ""),
      pickupLocation: String(body.pickupLocation || ""),
      dropoffLocation: String(body.dropoffLocation || ""),
    });

    return NextResponse.json({
      ok: true,
      estimatedFare: fare.estimatedFare,
      currency: fare.currency,
      distanceMiles: route.distanceMiles,
      durationMinutes: route.durationMinutes,
      fareBreakdown: fare.fareBreakdown,
      requiresManualReview: fare.requiresManualReview,
      routeSummary: route.routeSummary || null,
    });
  } catch (error) {
    if (error instanceof RoutesApiError) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: error.code,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        errorCode: "PRICING_ESTIMATE_FAILED",
        error: "Unable to calculate estimated fare right now.",
      },
      { status: 500 }
    );
  }
}
