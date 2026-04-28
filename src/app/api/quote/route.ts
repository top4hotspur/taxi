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
  const payload = (await request.json()) as Record<string, unknown>;

  for (const field of required) {
    if (typeof payload[field] !== "string" || !String(payload[field]).trim()) {
      return NextResponse.json({ success: false, message: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const session = await getCurrentSessionUser();
  const passengers = Number(payload.passengers);
  const golfBags = Number(payload.golfBags || 0);

  if (!Number.isFinite(passengers) || passengers < 1) {
    return NextResponse.json({ success: false, message: "Invalid passengers value." }, { status: 400 });
  }

  const result = await createQuote({
    customerId: session?.role === "customer" ? session.userId : undefined,
    guestEmail: session ? undefined : String(payload.email),
    guestName: session ? undefined : String(payload.name),
    guestPhone: session ? undefined : String(payload.phone),
    accountType: String(payload.accountType || "PERSONAL") === "BUSINESS" ? "BUSINESS" : "PERSONAL",
    serviceType: String(payload.serviceType),
    pickupLocation: String(payload.pickupLocation),
    dropoffLocation: String(payload.dropoffLocation),
    pickupDate: String(payload.pickupDate),
    pickupTime: String(payload.pickupTime),
    passengers,
    luggage: String(payload.luggage || ""),
    golfBags: Number.isFinite(golfBags) ? golfBags : 0,
    returnJourney: String(payload.returnJourney || "no").toLowerCase() === "yes",
    itineraryMessage: String(payload.itineraryMessage || ""),
  });

  const guestMessageBase = "Quote request received.";
  const guestEmailMessage = result.email.requesterEmail.ok
    ? " A confirmation email has been sent."
    : " We received your request and will contact you shortly.";

  return NextResponse.json({
    success: true,
    quoteId: result.quote.id,
    emailSent: result.email.requesterEmail.ok,
    message: session
      ? "Quote request saved to your account."
      : `${guestMessageBase}${guestEmailMessage} Create an account using the same email to track your request.`,
  });
}
