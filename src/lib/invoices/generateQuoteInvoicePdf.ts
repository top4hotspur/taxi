import PDFDocument from "pdfkit";
import type { QuoteRecord } from "@/lib/db";

function formatUkDate(value?: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

function formatUkDateTime(value?: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

function formatUkDateTimeFromParts(datePart?: string, timePart?: string) {
  if (!datePart) return "Not provided";
  return formatUkDateTime(`${datePart}T${timePart || "00:00"}:00`);
}

function formatGbp(amount?: number | null) {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return "Not provided";
  return `£${amount.toFixed(2)}`;
}

function invoiceNumberForQuote(quote: QuoteRecord) {
  const baseDate = quote.paidAt || quote.updatedAt || quote.createdAt;
  const date = new Date(baseDate);
  const yyyy = Number.isNaN(date.getTime()) ? "0000" : String(date.getFullYear());
  const mm = Number.isNaN(date.getTime()) ? "00" : String(date.getMonth() + 1).padStart(2, "0");
  const dd = Number.isNaN(date.getTime()) ? "00" : String(date.getDate()).padStart(2, "0");
  const shortQuoteId = quote.id.slice(0, 8).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${shortQuoteId}`;
}

function resolvePaidAmount(quote: QuoteRecord) {
  if (quote.paymentStatus !== "PAID") return null;
  if (Number.isFinite(Number(quote.paymentAmount))) return Number(quote.paymentAmount);
  if (Number.isFinite(Number(quote.confirmedPrice))) return Number(quote.confirmedPrice);
  return null;
}

export function getInvoiceFileName(quoteId: string) {
  return `ni-taxi-invoice-${quoteId.slice(0, 8).toUpperCase()}.pdf`;
}

export async function generateQuoteInvoicePdf(params: {
  quote: QuoteRecord;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}) {
  const { quote, customerName, customerEmail, customerPhone } = params;
  const paidAmount = resolvePaidAmount(quote);
  const invoiceNumber = invoiceNumberForQuote(quote);
  const shortQuoteId = quote.id.slice(0, 8).toUpperCase();

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

  doc.fontSize(18).text("NI Taxi Co");
  doc.fontSize(10).text("Registered Company Number: NI721173");
  doc.text("Email: contact@nitaxico.com");
  doc.text("Website: www.nitaxico.com");
  doc.moveDown();

  doc.fontSize(16).text("Invoice / Payment Receipt");
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Invoice number: ${invoiceNumber}`);
  doc.text(`Quote reference: ${shortQuoteId}`);
  doc.text(`Invoice date: ${formatUkDate(quote.paidAt || quote.updatedAt || quote.createdAt)}`);
  doc.text(`Payment date: ${formatUkDate(quote.paidAt)}`);
  doc.text("Payment method: Card payment processed by Square");
  doc.text(`Square payment ID: ${quote.squarePaymentId || "Not available"}`);
  doc.moveDown();

  const resolvedName =
    (customerName || "").trim() ||
    quote.guestName?.trim() ||
    quote.leadPassengerName?.trim() ||
    "Not provided";
  const resolvedEmail =
    (customerEmail || "").trim() ||
    quote.guestEmail?.trim() ||
    quote.leadPassengerEmail?.trim() ||
    "Not provided";
  const resolvedPhone =
    (customerPhone || "").trim() ||
    quote.guestPhone?.trim() ||
    quote.leadPassengerPhone?.trim() ||
    "Not provided";

  doc.fontSize(12).text("Customer details");
  doc.fontSize(10);
  doc.text(`Name: ${resolvedName}`);
  doc.text(`Email: ${resolvedEmail}`);
  doc.text(`Phone: ${resolvedPhone}`);
  doc.moveDown();

  doc.fontSize(12).text("Journey details");
  doc.fontSize(10);
  doc.text(`Service type: ${quote.serviceType || "Not provided"}`);
  doc.text(`Outward pickup: ${quote.pickupLocation || quote.pickupAddress || "Not provided"}`);
  doc.text(`Outward drop-off: ${quote.dropoffLocation || quote.dropoffAddress || "Not provided"}`);
  doc.text(`Outward date/time: ${formatUkDateTimeFromParts(quote.pickupDate, quote.pickupTime)}`);
  if (quote.outwardFlightNumber?.trim()) {
    doc.text(`Outward flight number: ${quote.outwardFlightNumber.trim()}`);
  }
  if (quote.returnJourney || quote.returnJourneyNeeded) {
    doc.text(`Return pickup: ${quote.returnPickup?.trim() || "Not provided"}`);
    doc.text(`Return drop-off: ${quote.returnDropoff?.trim() || "Not provided"}`);
    doc.text(`Return date/time: ${formatUkDateTimeFromParts(quote.returnDate, quote.returnTime)}`);
    if (quote.returnFlightNumber?.trim()) {
      doc.text(`Return flight number: ${quote.returnFlightNumber.trim()}`);
    }
  }
  doc.text(`Passengers: ${quote.passengers || 0}`);
  if ((quote.handLuggageCount || 0) > 0) doc.text(`Hand luggage: ${quote.handLuggageCount}`);
  if ((quote.suitcaseCount || 0) > 0) doc.text(`Suitcases: ${quote.suitcaseCount}`);
  if ((quote.oversizeItemCount || 0) > 0) doc.text(`Oversize items: ${quote.oversizeItemCount}`);
  doc.moveDown();

  doc.fontSize(12).text("Amount");
  doc.fontSize(10);
  doc.text(`Paid amount: ${formatGbp(paidAmount)}`);
  doc.text("Currency: GBP");
  doc.text("VAT: Not charged / not VAT registered");
  doc.text(`Total paid: ${formatGbp(paidAmount)}`);
  doc.moveDown();

  doc.fontSize(10).text("Thank you for booking with NI Taxi Co.");
  doc.text("This receipt confirms payment received for the journey shown above.");

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on("end", () => resolve());
  });
  return Buffer.concat(chunks);
}

