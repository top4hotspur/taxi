import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";
import { generateQuoteInvoicePdf, getInvoiceFileName } from "@/lib/invoices/generateQuoteInvoicePdf";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "customer") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const ownsQuote =
    quote.customerId === user.userId ||
    (quote.guestEmail || "").trim().toLowerCase() === normalizedEmail;
  if (!ownsQuote) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  if (quote.paymentStatus !== "PAID") {
    return NextResponse.json(
      { ok: false, message: "Invoice is only available after payment." },
      { status: 409 }
    );
  }

  const customerProfile = quote.customerId ? await db.getCustomerProfileByUserId(quote.customerId) : null;
  const pdf = await generateQuoteInvoicePdf({
    quote,
    customerName: customerProfile?.name || quote.guestName || null,
    customerEmail: quote.guestEmail || user.email || null,
    customerPhone: customerProfile?.phone || quote.guestPhone || null,
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${getInvoiceFileName(quote.id)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

