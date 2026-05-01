"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Summary = {
  totalQuotes: number;
  pendingQuoteRequests: number;
  quotesSent: number;
  acceptedQuotes: number;
  bookingsCreated: number;
  bookingsConfirmed: number;
};

type QuoteRow = {
  id: string;
  guestName?: string;
  guestEmail?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  status: string;
  customer?: { email?: string } | null;
};

const summaryCards: Array<{ key: keyof Summary; label: string }> = [
  { key: "pendingQuoteRequests", label: "New Quote Requests" },
  { key: "quotesSent", label: "Quotes Sent" },
  { key: "acceptedQuotes", label: "Accepted Quotes" },
  { key: "bookingsCreated", label: "Bookings Created" },
  { key: "bookingsConfirmed", label: "Bookings Confirmed" },
];

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/summary").then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        setError("Admin access required.");
        return;
      }
      setSummary(data.summary);
    });

    fetch("/api/admin/quotes").then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        setError("Admin access required.");
        return;
      }
      setQuotes((data.quotes || []) as QuoteRow[]);
    });
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      {error && <p className="text-red-700">{error}</p>}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card) => (
            <article key={card.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">{card.label}</p>
              <p className="text-2xl font-bold">{summary[card.key]}</p>
            </article>
          ))}
        </div>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Quotes</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-2 py-2 font-medium">ID</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Pickup</th>
                <th className="px-2 py-2 font-medium">Drop-off</th>
                <th className="px-2 py-2 font-medium">Date/Time</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <Link href={`/admin/quotes/${quote.id}`} className="underline">
                      {quote.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-2 py-2">{quote.guestName || "Account user"}</td>
                  <td className="px-2 py-2">{quote.guestEmail || quote.customer?.email || "N/A"}</td>
                  <td className="px-2 py-2">{quote.pickupLocation}</td>
                  <td className="px-2 py-2">{quote.dropoffLocation}</td>
                  <td className="px-2 py-2">{quote.pickupDate} {quote.pickupTime}</td>
                  <td className="px-2 py-2">{quote.status}</td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={7}>No quotes available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin/quotes" className="underline">Manage Quotes</Link>
        <Link href="/admin/customers" className="underline">View Customers</Link>
        <Link href="/admin/drivers" className="underline">Manage Drivers</Link>
        <Link href="/admin/pricing" className="underline">Pricing Rules</Link>
        <Link href="/admin/analytics" className="underline">Analytics</Link>
      </div>
    </section>
  );
}
