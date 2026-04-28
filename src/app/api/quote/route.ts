import { NextResponse } from "next/server";

const requiredFields = [
  "name",
  "email",
  "phone",
  "country",
  "serviceType",
  "pickup",
  "dropoff",
  "date",
  "time",
  "passengers",
  "returnJourney",
  "consent",
] as const;

export async function POST(request: Request) {
  const payload = (await request.json()) as Record<string, unknown>;

  for (const field of requiredFields) {
    const value = payload[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return NextResponse.json({ success: false, message: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  console.log("Quote enquiry received:", payload);

  return NextResponse.json({ success: true, message: "Quote request received." });
}
