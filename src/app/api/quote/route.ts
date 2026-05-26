import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentSessionUser } from "@/lib/auth/guards";
import { DbConfigMissingError } from "@/lib/db";
import { createQuote } from "@/lib/quote/service";

const required = ["serviceType", "pickupLocation", "dropoffLocation", "pickupDate", "pickupTime", "passengers"] as const;

function hasUsablePhone(value: string) {
  return value.trim().replace(/[^\d+]/g, "").length >= 7;
}

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  let quoteSaved = false;
  let emailAttempted = false;
  let emailSkipped = false;

  try {
    const payload = (await request.json()) as Record<string, unknown>;

    const session = await getCurrentSessionUser();
    if (!session || session.role !== "customer") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "LOGIN_REQUIRED",
          error: "Please create an account or sign in before submitting your quote.",
          message: "Please create an account or sign in before submitting your quote.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 401 }
      );
    }

    const requiredFields: string[] = [...required];
    const returnJourneyRequested =
      String(payload.returnJourneyNeeded || "").toLowerCase() === "true" ||
      String(payload.returnJourney || "no").toLowerCase() === "yes";
    if (returnJourneyRequested) {
      requiredFields.push("returnPickup", "returnDropoff", "returnDate", "returnTime");
    }

    for (const field of requiredFields) {
      if (typeof payload[field] !== "string" || !String(payload[field]).trim()) {
        return NextResponse.json(
          {
            ok: false,
            errorCode: "VALIDATION_FAILED",
            error: `Missing required field: ${field}`,
            correlationId,
            quoteSaved,
            emailAttempted,
            emailSkipped,
          },
          { status: 400 }
        );
      }
    }

    const passengers = Number(payload.passengers);
    const bookerName = String(payload.name || "").trim();
    const bookerEmail = String(session.email || payload.email || "").trim();
    const bookerPhone = String(payload.phone || "").trim();
    const handLuggageCount = Number(payload.handLuggageCount || 0);
    const suitcaseCount = Number(payload.suitcaseCount || 0);
    const oversizeItemCount = Number(payload.oversizeItemCount || 0);
    const pickupLat = Number(payload.pickupLat);
    const pickupLng = Number(payload.pickupLng);
    const dropoffLat = Number(payload.dropoffLat);
    const dropoffLng = Number(payload.dropoffLng);
    const estimatedFare = Number(payload.estimatedFare);
    const estimatedDistanceMiles = Number(payload.estimatedDistanceMiles);
    const estimatedDurationMinutes = Number(payload.estimatedDurationMinutes);
    const finalEstimatedFare = Number(payload.finalEstimatedFare);
    const outwardEstimatedFare = Number(payload.outwardEstimatedFare);
    const returnEstimatedFare = Number(payload.returnEstimatedFare);
    const returnDiscountPercent = Number(payload.returnDiscountPercent);
    const returnDiscountAmount = Number(payload.returnDiscountAmount);
    const returnPickupLat = Number(payload.returnPickupLat);
    const returnPickupLng = Number(payload.returnPickupLng);
    const returnDropoffLat = Number(payload.returnDropoffLat);
    const returnDropoffLng = Number(payload.returnDropoffLng);

    if (!Number.isFinite(passengers) || passengers < 1) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "Invalid passengers value.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }
    if (!bookerName) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "Please enter your name.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }
    if (!bookerEmail) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "Please enter your email address.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }
    if (!hasUsablePhone(bookerPhone)) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "Please enter your phone number so we can contact you about your booking.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }
    const termsAccepted = String(payload.termsAccepted || "").toLowerCase() === "true";
    if (!termsAccepted) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "You must accept Terms & Conditions and Policies before submitting.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }
    const leadPassengerSameAsBooker = String(payload.leadPassengerSameAsBooker || "true").toLowerCase() !== "false";
    if (!leadPassengerSameAsBooker && !String(payload.leadPassengerName || "").trim()) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "Please enter the lead passenger name.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }
    if (!leadPassengerSameAsBooker && !hasUsablePhone(String(payload.leadPassengerPhone || ""))) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "VALIDATION_FAILED",
          error: "Please enter the lead passenger phone number.",
          correlationId,
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }

    const result = await createQuote({
      correlationId,
      customerId: session.userId,
      guestEmail: undefined,
      guestName: bookerName,
      guestPhone: bookerPhone,
      passengerName: String(payload.passengerName || "") || undefined,
      passengerPhone: String(payload.passengerPhone || "") || undefined,
      leadPassengerSameAsBooker,
      leadPassengerName: leadPassengerSameAsBooker ? undefined : String(payload.leadPassengerName || "") || undefined,
      leadPassengerEmail: leadPassengerSameAsBooker ? undefined : String(payload.leadPassengerEmail || "") || undefined,
      leadPassengerPhone: leadPassengerSameAsBooker ? undefined : String(payload.leadPassengerPhone || "") || undefined,
      accountType: String(payload.accountType || "PERSONAL") === "BUSINESS" ? "BUSINESS" : "PERSONAL",
      serviceType: String(payload.serviceType),
      pickupLocation: String(payload.pickupLocation),
      pickupPlaceId: String(payload.pickupPlaceId || ""),
      pickupAddress: String(payload.pickupAddress || ""),
      pickupLat: Number.isFinite(pickupLat) ? pickupLat : undefined,
      pickupLng: Number.isFinite(pickupLng) ? pickupLng : undefined,
      dropoffLocation: String(payload.dropoffLocation),
      dropoffPlaceId: String(payload.dropoffPlaceId || ""),
      dropoffAddress: String(payload.dropoffAddress || ""),
      dropoffLat: Number.isFinite(dropoffLat) ? dropoffLat : undefined,
      dropoffLng: Number.isFinite(dropoffLng) ? dropoffLng : undefined,
      pickupDate: String(payload.pickupDate),
      pickupTime: String(payload.pickupTime),
      outwardFlightNumber: String(payload.outwardFlightNumber || "") || undefined,
      passengers,
      handLuggageCount: Number.isFinite(handLuggageCount) ? handLuggageCount : 0,
      suitcaseCount: Number.isFinite(suitcaseCount) ? suitcaseCount : 0,
      oversizeItemCount: Number.isFinite(oversizeItemCount) ? oversizeItemCount : 0,
      luggage: String(payload.luggage || ""),
      golfBags: Number(payload.golfBags || 0),
      returnJourney: String(payload.returnJourney || "no").toLowerCase() === "yes",
      returnJourneyNeeded: String(payload.returnJourneyNeeded || "").toLowerCase() === "true" || String(payload.returnJourney || "no").toLowerCase() === "yes",
      returnPickup: String(payload.returnPickup || ""),
      returnPickupPlaceId: String(payload.returnPickupPlaceId || ""),
      returnPickupAddress: String(payload.returnPickupAddress || ""),
      returnPickupLat: Number.isFinite(returnPickupLat) ? returnPickupLat : undefined,
      returnPickupLng: Number.isFinite(returnPickupLng) ? returnPickupLng : undefined,
      returnDropoff: String(payload.returnDropoff || ""),
      returnDropoffPlaceId: String(payload.returnDropoffPlaceId || ""),
      returnDropoffAddress: String(payload.returnDropoffAddress || ""),
      returnDropoffLat: Number.isFinite(returnDropoffLat) ? returnDropoffLat : undefined,
      returnDropoffLng: Number.isFinite(returnDropoffLng) ? returnDropoffLng : undefined,
      returnDate: String(payload.returnDate || ""),
      returnTime: String(payload.returnTime || ""),
      returnFlightNumber: String(payload.returnFlightNumber || "") || undefined,
      itineraryMessage: String(payload.itineraryMessage || ""),
      estimatedFare: Number.isFinite(estimatedFare) ? estimatedFare : undefined,
      finalEstimatedFare: Number.isFinite(finalEstimatedFare) ? finalEstimatedFare : undefined,
      outwardEstimatedFare: Number.isFinite(outwardEstimatedFare) ? outwardEstimatedFare : undefined,
      returnEstimatedFare: Number.isFinite(returnEstimatedFare) ? returnEstimatedFare : undefined,
      returnDiscountPercent: Number.isFinite(returnDiscountPercent) ? returnDiscountPercent : undefined,
      returnDiscountAmount: Number.isFinite(returnDiscountAmount) ? returnDiscountAmount : undefined,
      estimatedCurrency: String(payload.estimatedCurrency || "") || undefined,
      estimatedDistanceMiles: Number.isFinite(estimatedDistanceMiles) ? estimatedDistanceMiles : undefined,
      estimatedDurationMinutes: Number.isFinite(estimatedDurationMinutes) ? estimatedDurationMinutes : undefined,
      estimatedFareBreakdown: String(payload.estimatedFareBreakdown || "") || undefined,
      pricingSource: passengers > 8 ? "MANUAL_GROUP_QUOTE" : String(payload.pricingSource || "") || undefined,
      requiresManualReview: passengers > 8 || String(payload.requiresManualReview || "").toLowerCase() === "true",
      pricingCalculatedAt: String(payload.pricingCalculatedAt || "") || undefined,
      routeEstimateFailed: passengers > 8 ? false : String(payload.routeEstimateFailed || "").toLowerCase() === "true",
      routeEstimateFailureReason: passengers > 8
        ? "Manual group quote required for more than 8 passengers."
        : String(payload.routeEstimateFailureReason || "") || undefined,
      termsAccepted,
      termsAcceptedAt: new Date().toISOString(),
      policyVersion: String(payload.policyVersion || "v1-2026-05"),
    });

    quoteSaved = true;
    emailAttempted = true;
    emailSkipped = !!result.email.requesterEmail.skipped;

    return NextResponse.json({
      ok: true,
      success: true,
      correlationId,
      quoteId: result.quote.id,
      quoteSaved,
      emailAttempted,
      emailSkipped,
      emailSent: result.email.requesterEmail.ok,
      ...(result.email.requesterEmail.ok ? {} : { errorCode: "EMAIL_FAILED_NON_BLOCKING" }),
      message: "Your quote request has been submitted and saved in your account.",
    });
  } catch (error) {
    let errorCode: "DB_CONFIG_MISSING" | "DB_WRITE_FAILED" | "UNKNOWN_ERROR" = "UNKNOWN_ERROR";
    let errorMessage = "Unable to submit quote request at the moment. Please try again.";
    const status = 500;

    if (error instanceof DbConfigMissingError) {
      errorCode = "DB_CONFIG_MISSING";
      errorMessage = `Quote service is not configured. Missing: ${error.missingEnvVars.join(", ")}`;
    } else if (error instanceof Error) {
      errorCode = "DB_WRITE_FAILED";
      errorMessage = "Unable to save your quote request right now. Please try again shortly.";
    }

    console.error(
      JSON.stringify({
        level: "error",
        source: "api.quote",
        correlationId,
        errorCode,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );

    return NextResponse.json(
      {
        ok: false,
        errorCode,
        error: errorMessage,
        correlationId,
        quoteSaved,
        emailAttempted,
        emailSkipped,
      },
      { status }
    );
  }
}
