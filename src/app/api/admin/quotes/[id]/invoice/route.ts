import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { generateQuoteInvoicePdf, getInvoiceFileName } from "@/lib/invoices/generateQuoteInvoicePdf";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const quote = await db.findQuoteById(id);
  if (!quote) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }
  if (quote.paymentStatus !== "PAID") {
    return NextResponse.json(
      { ok: false, message: "Invoice is only available after payment." },
      { status: 409 }
    );
  }

  const customer = quote.customerId ? await db.findUserById(quote.customerId) : null;
  const customerProfile = quote.customerId ? await db.getCustomerProfileByUserId(quote.customerId) : null;
  const pdf = await generateQuoteInvoicePdf({
    quote,
    customerName: customerProfile?.name || quote.guestName || null,
    customerEmail: customer?.email || quote.guestEmail || null,
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

