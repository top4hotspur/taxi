import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) return NextResponse.json({ success: false, message: "Quote not found." }, { status: 404 });
  if (quote.paymentStatus !== "PAID") {
    return NextResponse.json({ success: false, message: "Driver assignment is only available for paid quotes." }, { status: 400 });
  }

  const body = (await request.json()) as { driverId?: string };
  const driverId = String(body.driverId || "").trim();
  if (!driverId) {
    return NextResponse.json({ success: false, message: "Driver is required." }, { status: 400 });
  }

  const driver = await db.getDriverProfileById(driverId);
  if (!driver) return NextResponse.json({ success: false, message: "Driver not found." }, { status: 404 });
  const isActive = driver.isActive !== false && driver.status === "ACTIVE";
  if (!isActive) {
    return NextResponse.json({ success: false, message: "Driver is inactive." }, { status: 400 });
  }

  const assignedAt = new Date().toISOString();
  const updated = await db.updateQuote(id, {
    assignedDriverId: driver.id,
    assignedDriverName: driver.name,
    assignedDriverPhone: driver.mobile,
    assignedDriverEmail: driver.email,
    assignedDriverPhotoUrl: driver.photoUrl || driver.profilePhoto || undefined,
    assignedVehicleMake: [driver.carColour, driver.carMake, driver.carModel].filter(Boolean).join(" "),
    assignedVehicleColour: driver.carColour || undefined,
    assignedVehicleRegistration: driver.registrationNumber,
    assignedAt,
    assignmentStatus: "ASSIGNED",
    lastCommunicationError: undefined,
  });

  return NextResponse.json({ success: true, quote: updated });
}
