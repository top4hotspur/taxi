import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  const required = ["name","email","mobile","addressLine1","city","region","postalCode","country","carMake","carModel","registrationNumber","passengerCapacity","suitcaseCapacity","password"];
  for (const field of required) {
    if (!body[field]?.trim()) return NextResponse.json({ success: false, message: `Missing required field: ${field}` }, { status: 400 });
  }

  const existing = await db.findUserByEmail(body.email);
  if (existing) return NextResponse.json({ success: false, message: "Email already in use." }, { status: 409 });

  const user = await db.createUser({ email: body.email.toLowerCase(), passwordHash: hashPassword(body.password), role: "DRIVER" });
  const profile = await db.createOrUpdateDriverProfile({
    userId: user.id,
    name: body.name,
    email: body.email.toLowerCase(),
    mobile: body.mobile,
    addressLine1: body.addressLine1,
    addressLine2: body.addressLine2 || null,
    city: body.city,
    region: body.region,
    postalCode: body.postalCode,
    country: body.country,
    carMake: body.carMake,
    carModel: body.carModel,
    registrationNumber: body.registrationNumber,
    passengerCapacity: Number(body.passengerCapacity),
    suitcaseCapacity: Number(body.suitcaseCapacity),
    profilePhoto: null,
    status: "INCOMPLETE",
  });

  return NextResponse.json({ success: true, userId: user.id, profileId: profile.id });
}
