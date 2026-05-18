import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db, DbConfigMissingError } from "@/lib/db";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/driver/constants";
import { resolveDriverPhotoUrl } from "@/lib/storage/driverPhotos";

function computeFlags(documents: { type: string; status: string; expiryDate?: string | null }[]) {
  const now = new Date().toISOString().slice(0, 10);
  const missing = DRIVER_DOCUMENT_TYPES.filter((type) => !documents.some((d) => d.type === type));
  const expired = documents.filter((d) => d.expiryDate && d.expiryDate < now).map((d) => d.type);
  return { missingDocuments: missing, expiredDocuments: expired };
}

async function toDriverListItem(profile: Awaited<ReturnType<typeof db.listDriverProfiles>>[number]) {
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

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";

  const profiles = await db.listDriverProfiles();
  const filtered = activeOnly
    ? profiles.filter((p) => p.isActive !== false && p.status === "ACTIVE")
    : profiles;

  const items = await Promise.all(
    filtered.map(async (profile) => {
      const documents = await db.listDriverDocumentsByUserId(profile.userId);
      return {
        ...(await toDriverListItem(profile)),
        ...computeFlags(documents),
      };
    }),
  );

  return NextResponse.json({ success: true, drivers: items });
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  try {
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

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const carMake = String(body.carMake || "").trim();
    const carModel = String(body.carModel || "").trim();
    const carColour = String(body.carColour || "").trim();
    const registrationNumber = String(body.registrationNumber || "").trim().toUpperCase();
    const photoUrl = String(body.photoUrl || "").trim();
    const photoKey = String(body.photoKey || "").trim();

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_FAILED", message: "Driver name and phone are required." },
        { status: 400 },
      );
    }

    if (!email || !carMake || !registrationNumber) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_FAILED", message: "Driver email, car make and registration are required." },
        { status: 400 },
      );
    }

    const existing = (await db.listDriverProfiles()).find((p) => p.email.toLowerCase() === email);
    if (existing) {
      return NextResponse.json({ success: false, errorCode: "DRIVER_EXISTS", message: "A driver with this email already exists." }, { status: 409 });
    }

    const created = await db.createAdminDriverProfile({
      name,
      email,
      mobile: phone,
      photoUrl: photoUrl || null,
      photoKey: photoKey || null,
      carMake,
      carModel,
      carColour: carColour || null,
      registrationNumber,
      isActive: body.isActive !== false,
    });

    return NextResponse.json({ success: true, driver: await toDriverListItem(created) });
  } catch (error) {
    if (error instanceof DbConfigMissingError) {
      const driverTableMissing = error.missingEnvVars.includes("DDB_TABLE_DRIVER_PROFILES");
      return NextResponse.json(
        {
          success: false,
          errorCode: "DRIVER_TABLE_NOT_CONFIGURED",
          message: driverTableMissing
            ? "Driver table is not configured."
            : "Driver could not be saved. Please check admin health.",
        },
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

    console.error(
      JSON.stringify({
        level: "error",
        source: "api.admin.drivers.create",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );

    return NextResponse.json(
      { success: false, errorCode: "DRIVER_SAVE_FAILED", message: "Driver could not be saved. Please check admin health." },
      { status: 500 }
    );
  }
}
