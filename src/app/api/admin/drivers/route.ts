import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/driver/constants";

function computeFlags(documents: { type: string; status: string; expiryDate?: string | null }[]) {
  const now = new Date().toISOString().slice(0, 10);
  const missing = DRIVER_DOCUMENT_TYPES.filter((type) => !documents.some((d) => d.type === type));
  const expired = documents.filter((d) => d.expiryDate && d.expiryDate < now).map((d) => d.type);
  return { missingDocuments: missing, expiredDocuments: expired };
}

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const profiles = await db.listDriverProfiles();
  const items = await Promise.all(
    profiles.map(async (profile) => {
      const documents = await db.listDriverDocumentsByUserId(profile.userId);
      return {
        profile,
        documents,
        ...computeFlags(documents),
      };
    })
  );

  return NextResponse.json({ success: true, drivers: items });
}
