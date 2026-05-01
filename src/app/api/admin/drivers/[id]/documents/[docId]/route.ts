import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { id, docId } = await context.params;
  const profile = await db.getDriverProfileById(id);
  if (!profile) return NextResponse.json({ success: false, message: "Driver not found" }, { status: 404 });

  const body = (await request.json()) as { status?: "MISSING" | "UPLOADED" | "APPROVED" | "REJECTED" | "EXPIRED"; adminNotes?: string };
  const existing = await db.getDriverDocumentById(docId);
  if (!existing || existing.userId !== profile.userId) return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });

  const updated = await db.updateDriverDocument(docId, {
    status: body.status ?? existing.status,
    adminNotes: body.adminNotes ?? existing.adminNotes,
    reviewedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, document: updated });
}
