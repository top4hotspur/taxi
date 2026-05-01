"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getQuoteStatusLabel } from "@/lib/quote/constants";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type Quote = {
  id: string;
  status: string;
  serviceType: string;
  pickupDate: string;
  pickupTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  returnJourney?: boolean;
  returnJourneyNeeded?: boolean;
  finalEstimatedFare?: number;
  estimatedFare?: number;
  estimatedCurrency?: string;
  createdAt: string;
};

export default function AccountPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    trackAnalyticsEvent("ACCOUNT_QUOTES_VIEWED", "/account");
    fetch("/api/account/quotes", { cache: "no-store" }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        setError("Please login as a customer to view account quotes.");
        return;
      }
      setQuotes((data.quotes || []) as Quote[]);
    }).catch(() => setError("Unable to load your quotes right now."));
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">My Quotes</h1>
        <Link href="/quote" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Request a quote</Link>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {quotes.length === 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No quotes yet. Request a quote and it will appear here.
        </article>
      ) : (
        <div className="grid gap-4">
          {quotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((q) => (
            <article key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
              <p className="text-base font-semibold">{q.pickupLocation} → {q.dropoffLocation}</p>
              <p>{q.pickupDate} {q.pickupTime}</p>
              <p>Service: {q.serviceType}</p>
              <p>Status: {getQuoteStatusLabel(q.status)}</p>
              <p>Estimate: {(q.finalEstimatedFare ?? q.estimatedFare) ? `${q.finalEstimatedFare ?? q.estimatedFare} ${q.estimatedCurrency || "GBP"}` : "Manual review required"}</p>
              {(q.returnJourneyNeeded || q.returnJourney) && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Return journey</span>}
              <p className="mt-1 text-xs text-slate-500">Created: {new Date(q.createdAt).toLocaleString()}</p>
              <Link href={`/account/quotes/${q.id}`} className="mt-3 inline-block underline">View details</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
