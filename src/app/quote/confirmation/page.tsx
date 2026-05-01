import Link from "next/link";

export default function QuoteConfirmationPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">Your quote request has been submitted.</h1>
      <p className="text-slate-700">
        You can view this quote in your account. We&apos;ll review the journey details and update the quote shortly.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/account" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          View my quotes
        </Link>
        <Link href="/" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
          Go home
        </Link>
      </div>
    </section>
  );
}
