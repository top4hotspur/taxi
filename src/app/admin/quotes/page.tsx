"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Quote = {
  id: string;
  status: string;
  serviceType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  quotedPrice?: number;
  quotedCurrency: string;
  createdAt: string;
  guestName?: string;
  guestEmail?: string;
  customer?: { email?: string } | null;
};

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const query = status ? `?status=${status}` : "";
    fetch(`/api/admin/quotes${query}`).then(async (res) => {
      const data = await res.json();
      if (!res.ok) return;
      setQuotes(data.quotes || []);
    });
  }, [status]);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Quotes</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-slate-300 px-3 py-2">
        <option value="">All statuses</option>
        {[
          "QUOTE_REQUESTED",
          "QUOTE_UPDATED",
          "QUOTE_SENT",
          "QUOTE_ACCEPTED",
          "QUOTE_DECLINED",
          "QUOTE_IGNORED",
          "BOOKING_CREATED",
          "BOOKING_CONFIRMED",
          "BOOKING_CANCELLED",
        ].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Pickup</th>
              <th className="px-3 py-2 font-medium">Drop-off</th>
              <th className="px-3 py-2 font-medium">Date/Time</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Quoted Price</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-b border-slate-100 align-top">
                <td className="px-3 py-2">{quote.guestName || "Account customer"}</td>
                <td className="px-3 py-2">{quote.guestEmail || quote.customer?.email || "N/A"}</td>
                <td className="px-3 py-2">{quote.serviceType}</td>
                <td className="px-3 py-2">{quote.pickupLocation}</td>
                <td className="px-3 py-2">{quote.dropoffLocation}</td>
                <td className="px-3 py-2">{quote.pickupDate} {quote.pickupTime}</td>
                <td className="px-3 py-2">{quote.status}</td>
                <td className="px-3 py-2">{quote.quotedPrice !== undefined ? `${quote.quotedPrice} ${quote.quotedCurrency || "GBP"}` : "Pending"}</td>
                <td className="px-3 py-2">{new Date(quote.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/quotes/${quote.id}`} className="underline">View / Edit</Link>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-slate-500">No quotes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
