import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const profile = await db.getDriverProfileById(id);
  if (!profile) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const documents = await db.listDriverDocumentsByUserId(profile.userId);
  return NextResponse.json({ success: true, profile, documents });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const profile = await db.getDriverProfileById(id);
  if (!profile) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = (await request.json()) as { status?: "PENDING" | "INCOMPLETE" | "ACTIVE" | "SUSPENDED" };
  if (!body.status) return NextResponse.json({ success: false, message: "Missing status." }, { status: 400 });

  const updated = await db.createOrUpdateDriverProfile({ ...profile, status: body.status });
  return NextResponse.json({ success: true, profile: updated });
}
