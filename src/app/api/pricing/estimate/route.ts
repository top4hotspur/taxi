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
    const oversizeItemCount = Number(body.oversizeItemCount || 0);
    const pickupDate = String(body.pickupDate || "");
    const pickupTime = String(body.pickupTime || "");
    if (Number.isFinite(passengers) && passengers > 8) {
      return NextResponse.json(
        {
          ok: true,
          estimatedFare: null,
          finalEstimatedFare: null,
          outwardEstimatedFare: null,
          returnEstimatedFare: null,
          returnDiscountPercent: null,
          returnDiscountAmount: null,
          currency: "GBP",
          distanceMiles: null,
          durationMinutes: null,
          fareBreakdown: null,
          pricingSource: "MANUAL_GROUP_QUOTE",
          requiresManualReview: true,
          routeEstimateFailed: false,
          routeEstimateFailureReason: null,
          customerMessage: "We can't estimate prices online for groups larger than 8 passengers. Please submit your request and we'll be in touch shortly with a tailored quote.",
          manualGroupQuote: true,
          errorCode: "MANUAL_GROUP_QUOTE",
        },
        { status: 200 }
      );
    }

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

    const outboundRoute = await computeRouteEstimate({
      pickupPlaceId: String(body.pickupPlaceId || "") || undefined,
      pickupLat: Number.isFinite(pickupLat) ? pickupLat : undefined,
      pickupLng: Number.isFinite(pickupLng) ? pickupLng : undefined,
      dropoffPlaceId: String(body.dropoffPlaceId || "") || undefined,
      dropoffLat: Number.isFinite(dropoffLat) ? dropoffLat : undefined,
      dropoffLng: Number.isFinite(dropoffLng) ? dropoffLng : undefined,
    });

    const pricingConfig = await getEffectivePricingConfig();
    const outwardFare = estimateFare({
      distanceMiles: outboundRoute.distanceMiles,
      durationMinutes: outboundRoute.durationMinutes,
      serviceType: String(body.serviceType || ""),
      pickupDate,
      pickupTime,
      passengers: Number.isFinite(passengers) ? passengers : undefined,
      oversizeItemCount: Number.isFinite(oversizeItemCount) ? oversizeItemCount : undefined,
      itineraryMessage: String(body.itineraryMessage || ""),
      pickupLocation: String(body.pickupLocation || ""),
      dropoffLocation: String(body.dropoffLocation || ""),
    }, pricingConfig.settings, pricingConfig.timeUplifts, pricingConfig.dateUplifts);

    const returnJourney = String(body.returnJourney || "No").toLowerCase() === "yes";
    let returnRoute: Awaited<ReturnType<typeof computeRouteEstimate>> | null = null;
    let returnFare: ReturnType<typeof estimateFare> | null = null;

    if (returnJourney) {
      const returnPickupLocation = String(body.returnPickupLocation || "").trim();
      const returnDropoffLocation = String(body.returnDropoffLocation || "").trim();
      if (!returnPickupLocation || !returnDropoffLocation || !String(body.returnDate || "").trim() || !String(body.returnTime || "").trim()) {
        return NextResponse.json(
          {
            ok: true,
            estimatedFare: null,
            currency: pricingConfig.settings.currency || "GBP",
            distanceMiles: null,
            durationMinutes: null,
            fareBreakdown: null,
            pricingSource: "FALLBACK_MANUAL_REVIEW",
            requiresManualReview: true,
            routeEstimateFailed: true,
            routeEstimateFailureReason: "Return journey details were incomplete.",
            customerMessage: "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.",
            errorCode: "ROUTES_INPUT_INVALID",
          },
          { status: 200 }
        );
      }

      const returnPickupLat = Number(body.returnPickupLat);
      const returnPickupLng = Number(body.returnPickupLng);
      const returnDropoffLat = Number(body.returnDropoffLat);
      const returnDropoffLng = Number(body.returnDropoffLng);

      returnRoute = await computeRouteEstimate({
        pickupPlaceId: String(body.returnPickupPlaceId || "") || undefined,
        pickupLat: Number.isFinite(returnPickupLat) ? returnPickupLat : undefined,
        pickupLng: Number.isFinite(returnPickupLng) ? returnPickupLng : undefined,
        dropoffPlaceId: String(body.returnDropoffPlaceId || "") || undefined,
        dropoffLat: Number.isFinite(returnDropoffLat) ? returnDropoffLat : undefined,
        dropoffLng: Number.isFinite(returnDropoffLng) ? returnDropoffLng : undefined,
      });

      returnFare = estimateFare(
        {
          distanceMiles: returnRoute.distanceMiles,
          durationMinutes: returnRoute.durationMinutes,
          serviceType: String(body.serviceType || ""),
          pickupDate: String(body.returnDate || ""),
          pickupTime: String(body.returnTime || ""),
          passengers: Number.isFinite(passengers) ? passengers : undefined,
          oversizeItemCount: Number.isFinite(oversizeItemCount) ? oversizeItemCount : undefined,
          itineraryMessage: String(body.itineraryMessage || ""),
          pickupLocation: returnPickupLocation,
          dropoffLocation: returnDropoffLocation,
        },
        pricingConfig.settings,
        pricingConfig.timeUplifts,
        pricingConfig.dateUplifts
      );
    }

    const combinedSubtotal = Number((outwardFare.estimatedFare + (returnFare?.estimatedFare || 0)).toFixed(2));
    const returnDiscountPercent = returnFare ? 10 : 0;
    const returnDiscountAmount = returnFare ? Number(((combinedSubtotal * returnDiscountPercent) / 100).toFixed(2)) : 0;
    const finalEstimatedFare = Number((combinedSubtotal - returnDiscountAmount).toFixed(2));
    const distanceMiles = Number((outboundRoute.distanceMiles + (returnRoute?.distanceMiles || 0)).toFixed(2));
    const durationMinutes = Number((outboundRoute.durationMinutes + (returnRoute?.durationMinutes || 0)).toFixed(1));

    const combinedBreakdown = {
      outward: outwardFare.fareBreakdown,
      return: returnFare?.fareBreakdown || null,
      combinedSubtotal,
      returnDiscountPercent,
      returnDiscountAmount,
      finalEstimatedFare,
    };

    return NextResponse.json({
      ok: true,
      estimatedFare: finalEstimatedFare,
      finalEstimatedFare,
      outwardEstimatedFare: outwardFare.estimatedFare,
      returnEstimatedFare: returnFare?.estimatedFare || null,
      returnDiscountPercent,
      returnDiscountAmount,
      currency: outwardFare.currency,
      distanceMiles,
      durationMinutes,
      fareBreakdown: combinedBreakdown,
      pricingSource: "GOOGLE_ROUTES",
      requiresManualReview: outwardFare.requiresManualReview || Boolean(returnFare?.requiresManualReview),
      routeEstimateFailed: false,
      routeEstimateFailureReason: null,
      routeSummary: outboundRoute.routeSummary || null,
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
