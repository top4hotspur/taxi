import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/driver/constants";
import { generateDriverDocumentReference } from "@/lib/storage/driverUploads";

async function requireDriverUser() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "driver") return null;
  return user;
}

export async function GET() {
  const user = await requireDriverUser();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const documents = await db.listDriverDocumentsByUserId(user.userId);
  return NextResponse.json({ success: true, documents });
}

export async function POST(request: Request) {
  const user = await requireDriverUser();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, string>;
  const type = String(body.type || "");
  if (!DRIVER_DOCUMENT_TYPES.includes(type as (typeof DRIVER_DOCUMENT_TYPES)[number])) {
    return NextResponse.json({ success: false, message: "Invalid document type." }, { status: 400 });
  }

  const fileReference = body.uploadedFileReference?.trim()
    ? body.uploadedFileReference.trim()
    : generateDriverDocumentReference({ userId: user.userId, type, originalFileName: String(body.fileName || "document.pdf") });

  const doc = await db.createDriverDocument({
    userId: user.userId,
    type: type as "TAXI_LICENCE" | "TAXI_CAR_LICENCE" | "INSURANCE" | "DRIVING_LICENCE",
    uploadedFileReference: fileReference,
    expiryDate: body.expiryDate || null,
    status: "UPLOADED",
    adminNotes: null,
    uploadedAt: new Date().toISOString(),
    reviewedAt: null,
  });

  return NextResponse.json({ success: true, document: doc });
}
