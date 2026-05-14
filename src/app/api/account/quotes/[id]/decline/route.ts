import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { sendStatusLifecycleEmails, updateQuoteStatusAudit } from "@/lib/quote/service";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const normalizedEmail = user.email.trim().toLowerCase();
  const quote = (await db.listQuotes()).find(
    (q) => q.id === id && (q.customerId === user.userId || (q.guestEmail || "").trim().toLowerCase() === normalizedEmail),
  );
  if (!quote) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const updated = await db.updateQuote(id, { status: "DECLINED" });
  await updateQuoteStatusAudit({
    quoteId: id,
    changedByRole: "customer",
    changedByUserId: user.userId,
    previousStatus: quote.status,
    newStatus: "DECLINED",
    note: "Customer declined quote",
  });

  if (updated) {
    await sendStatusLifecycleEmails({ quote: updated, newStatus: "DECLINED" });
  }

  return NextResponse.json({ success: true, quote: updated });
}
