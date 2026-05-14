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
  paidQuotes: number;
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
  paymentStatus?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  customer?: { email?: string } | null;
};

const summaryCards: Array<{ key: keyof Summary; label: string }> = [
  { key: "pendingQuoteRequests", label: "New Quote Requests" },
  { key: "quotesSent", label: "Quotes Sent" },
  { key: "acceptedQuotes", label: "Accepted Quotes" },
  { key: "bookingsCreated", label: "Bookings Created" },
  { key: "bookingsConfirmed", label: "Bookings Confirmed" },
  { key: "paidQuotes", label: "Paid Quotes" },
];

function formatMoney(amount?: number, currency = "GBP") {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [recentPaid, setRecentPaid] = useState<QuoteRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/summary").then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        setError("Admin access required.");
        return;
      }
      setSummary(data.summary);
      setRecentPaid((data.recentPaidQuotes || []) as QuoteRow[]);
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
        <h2 className="text-lg font-semibold text-slate-900">Recently Paid</h2>
        {recentPaid.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No paid quotes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recentPaid.map((quote) => (
              <li key={quote.id} className="rounded border border-emerald-200 bg-emerald-50 p-3">
                <div className="font-medium">{quote.guestName || quote.customer?.email || "Customer"} • {formatMoney(quote.paymentAmount, quote.paymentCurrency || "GBP")}</div>
                <div className="text-slate-700">{quote.pickupLocation} → {quote.dropoffLocation} ({quote.pickupDate} {quote.pickupTime})</div>
                <Link href={`/admin/quotes/${quote.id}`} className="text-slate-800 underline">View quote</Link>
              </li>
            ))}
          </ul>
        )}
      </article>

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
                <th className="px-2 py-2 font-medium">Payment</th>
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
                  <td className="px-2 py-2">{quote.paymentStatus || "NOT_REQUIRED"}</td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={8}>No quotes available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
