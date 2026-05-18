import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db, DbConfigMissingError } from "@/lib/db";
import { resolveDriverPhotoUrl } from "@/lib/storage/driverPhotos";

async function toDriver(profile: Awaited<ReturnType<typeof db.getDriverProfileById>> | null) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.mobile,
    photoUrl: await resolveDriverPhotoUrl({ photoKey: profile.photoKey, photoUrl: profile.photoUrl || profile.profilePhoto || null }),
    photoKey: profile.photoKey || null,
    carMake: profile.carMake || "",
    carModel: profile.carModel || "",
    carColour: profile.carColour || "",
    registrationNumber: profile.registrationNumber || "",
    isActive: profile.isActive !== false && profile.status === "ACTIVE",
    status: profile.status,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const profile = await db.getDriverProfileById(id);
  if (!profile) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const documents = await db.listDriverDocumentsByUserId(profile.userId);
  return NextResponse.json({ success: true, driver: await toDriver(profile), documents });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const existing = await db.getDriverProfileById(id);
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    photoKey?: string;
    carMake?: string;
    carModel?: string;
    carColour?: string;
    registrationNumber?: string;
    isActive?: boolean;
  };

  const name = String(body.name || existing.name).trim();
  const email = String(body.email || existing.email).trim().toLowerCase();
  const phone = String(body.phone || existing.mobile).trim();
  const carMake = String(body.carMake || existing.carMake).trim();
  const carModel = String(body.carModel || existing.carModel || "").trim();
  const carColour = String(body.carColour || existing.carColour || "").trim();
  const registrationNumber = String(body.registrationNumber || existing.registrationNumber).trim().toUpperCase();
  const photoUrl = String(body.photoUrl || existing.photoUrl || existing.profilePhoto || "").trim();
  const photoKey = String(body.photoKey || existing.photoKey || "").trim();
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive !== false && existing.status === "ACTIVE";

  if (!name || !email || !phone || !carMake || !registrationNumber) {
    return NextResponse.json(
      { success: false, message: "Name, email, phone, car make and registration are required." },
      { status: 400 },
    );
  }

  const emailConflict = (await db.listDriverProfiles()).find((p) => p.id !== existing.id && p.email.toLowerCase() === email);
  if (emailConflict) {
    return NextResponse.json({ success: false, message: "Another driver already uses this email." }, { status: 409 });
  }

  try {
    const updated = await db.updateDriverProfileById(existing.id, {
      name,
      email,
      mobile: phone,
      photoUrl: photoUrl || null,
      photoKey: photoKey || null,
      profilePhoto: photoUrl || null,
      carMake,
      carModel,
      carColour: carColour || null,
      registrationNumber,
      isActive,
      status: isActive ? "ACTIVE" : "SUSPENDED",
    });

    return NextResponse.json({ success: true, driver: await toDriver(updated) });
  } catch (error) {
    if (error instanceof DbConfigMissingError && error.missingEnvVars.includes("DDB_TABLE_DRIVER_PROFILES")) {
      return NextResponse.json(
        { success: false, errorCode: "DRIVER_TABLE_NOT_CONFIGURED", message: "Driver table is not configured." },
        { status: 503 }
      );
    }
    const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (awsError?.name === "ResourceNotFoundException") {
      return NextResponse.json(
        { success: false, errorCode: "DRIVER_TABLE_UNAVAILABLE", message: "Driver table is unavailable." },
        { status: 503 }
      );
    }
    if (awsError?.name === "AccessDeniedException" || awsError?.$metadata?.httpStatusCode === 403) {
      return NextResponse.json(
        { success: false, errorCode: "DRIVER_SAVE_FORBIDDEN", message: "Driver could not be saved. Please check admin health." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "DRIVER_SAVE_FAILED", message: "Driver could not be saved. Please check admin health." },
      { status: 500 }
    );
  }
}
