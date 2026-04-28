import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

async function requireDriverUser() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "driver") return null;
  return user;
}

export async function GET() {
  const user = await requireDriverUser();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const profile = await db.getDriverProfileByUserId(user.userId);
  return NextResponse.json({ success: true, profile });
}

export async function PATCH(request: Request) {
  const user = await requireDriverUser();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const current = await db.getDriverProfileByUserId(user.userId);
  if (!current) return NextResponse.json({ success: false, message: "Driver profile not found." }, { status: 404 });

  const updated = await db.createOrUpdateDriverProfile({
    ...current,
    name: String(body.name ?? current.name),
    email: String(body.email ?? current.email),
    mobile: String(body.mobile ?? current.mobile),
    addressLine1: String(body.addressLine1 ?? current.addressLine1),
    addressLine2: String(body.addressLine2 ?? current.addressLine2 ?? "") || null,
    city: String(body.city ?? current.city),
    region: String(body.region ?? current.region),
    postalCode: String(body.postalCode ?? current.postalCode),
    country: String(body.country ?? current.country),
    carMake: String(body.carMake ?? current.carMake),
    carModel: String(body.carModel ?? current.carModel),
    registrationNumber: String(body.registrationNumber ?? current.registrationNumber),
    passengerCapacity: Number(body.passengerCapacity ?? current.passengerCapacity),
    suitcaseCapacity: Number(body.suitcaseCapacity ?? current.suitcaseCapacity),
    profilePhoto: String(body.profilePhoto ?? current.profilePhoto ?? "") || null,
    status: current.status,
  });

  return NextResponse.json({ success: true, profile: updated });
}
