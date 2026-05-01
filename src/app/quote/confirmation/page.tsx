import Link from "next/link";
import { db } from "@/lib/db";
import QuoteConfirmationTracker from "@/components/QuoteConfirmationTracker";

export default async function QuoteConfirmationPage({ searchParams }: { searchParams: Promise<{ quoteId?: string }> }) {
  const params = await searchParams;
  const quoteId = params.quoteId?.trim();
  const quote = quoteId ? await db.findQuoteById(quoteId) : null;

  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <QuoteConfirmationTracker />
      <h1 className="text-3xl font-bold text-slate-900">Your quote request has been submitted</h1>
      <p className="text-slate-700">
        Your request is now saved in your account. We&apos;ll review the journey details, confirm driver availability, and update the quote shortly.
      </p>

      {quote && (
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><strong>Quote reference:</strong> {quote.id}</p>
          <p><strong>Route:</strong> {quote.pickupLocation} to {quote.dropoffLocation}</p>
          <p><strong>Date/time:</strong> {quote.pickupDate} {quote.pickupTime}</p>
          <p><strong>Estimated fare:</strong> {(quote.finalEstimatedFare ?? quote.estimatedFare) ? `${quote.finalEstimatedFare ?? quote.estimatedFare} ${quote.estimatedCurrency || "GBP"}` : "Manual review required"}</p>
          <p><strong>Status:</strong> Submitted / awaiting confirmation</p>
        </article>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/account" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">View my quotes</Link>
        <Link href="/quote" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">Request another quote</Link>
        <Link href="/" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">Go home</Link>
      </div>
    </section>
  );
}
