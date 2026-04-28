import { NextResponse } from "next/server";

import { getCurrentSessionUser } from "@/lib/auth/guards";
import { createQuote } from "@/lib/quote/service";

const required = [
  "name",
  "email",
  "phone",
  "serviceType",
  "pickupLocation",
  "dropoffLocation",
  "pickupDate",
  "pickupTime",
  "passengers",
] as const;

export async function POST(request: Request) {
  let quoteSaved = false;
  let emailAttempted = false;
  let emailSkipped = false;

  try {
    const payload = (await request.json()) as Record<string, unknown>;

    for (const field of required) {
      if (typeof payload[field] !== "string" || !String(payload[field]).trim()) {
        return NextResponse.json(
          {
            ok: false,
            error: `Missing required field: ${field}`,
            quoteSaved,
            emailAttempted,
            emailSkipped,
          },
          { status: 400 }
        );
      }
    }

    const session = await getCurrentSessionUser();
    const passengers = Number(payload.passengers);
    const golfBags = Number(payload.golfBags || 0);
    const pickupLat = Number(payload.pickupLat);
    const pickupLng = Number(payload.pickupLng);
    const dropoffLat = Number(payload.dropoffLat);
    const dropoffLng = Number(payload.dropoffLng);

    if (!Number.isFinite(passengers) || passengers < 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid passengers value.",
          quoteSaved,
          emailAttempted,
          emailSkipped,
        },
        { status: 400 }
      );
    }

    const result = await createQuote({
      customerId: session?.role === "customer" ? session.userId : undefined,
      guestEmail: session ? undefined : String(payload.email),
      guestName: session ? undefined : String(payload.name),
      guestPhone: session ? undefined : String(payload.phone),
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
      passengers,
      luggage: String(payload.luggage || ""),
      golfBags: Number.isFinite(golfBags) ? golfBags : 0,
      returnJourney: String(payload.returnJourney || "no").toLowerCase() === "yes",
      itineraryMessage: String(payload.itineraryMessage || ""),
    });

    quoteSaved = true;
    emailAttempted = true;
    emailSkipped = !!result.email.requesterEmail.skipped;

    const guestMessageBase = "Quote request received.";
    const guestEmailMessage = result.email.requesterEmail.ok
      ? " A confirmation email has been sent."
      : " We received your request and will contact you shortly.";

    return NextResponse.json({
      ok: true,
      success: true,
      quoteId: result.quote.id,
      quoteSaved,
      emailAttempted,
      emailSkipped,
      emailSent: result.email.requesterEmail.ok,
      message: session
        ? "Quote request saved to your account."
        : `${guestMessageBase}${guestEmailMessage} Create an account using the same email to track your request.`,
    });
  } catch (error) {
    console.error("[api/quote] submit failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to submit quote request at the moment. Please try again.",
        quoteSaved,
        emailAttempted,
        emailSkipped,
      },
      { status: 500 }
    );
  }
}
