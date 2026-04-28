"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Quote = { id: string; status: string; serviceType: string; pickupDate: string; guestEmail?: string; customer?: { email: string } };

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
          "QUOTE_REQUESTED","QUOTE_UPDATED","QUOTE_SENT","QUOTE_ACCEPTED","QUOTE_DECLINED","QUOTE_IGNORED","BOOKING_CREATED","BOOKING_CONFIRMED","BOOKING_CANCELLED",
        ].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <ul className="space-y-3">
        {quotes.map((quote) => (
          <li key={quote.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p><strong>{quote.serviceType}</strong> - {quote.status}</p>
            <p>{quote.pickupDate}</p>
            <p>{quote.customer?.email || quote.guestEmail || "Guest"}</p>
            <Link href={`/admin/quotes/${quote.id}`} className="underline">Open quote</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
