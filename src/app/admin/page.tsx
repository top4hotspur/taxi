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

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
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
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      {error && <p className="text-red-700">{error}</p>}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary).map(([key, value]) => (
            <article key={key} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">{key}</p>
              <p className="text-2xl font-bold">{value}</p>
            </article>
          ))}
        </div>
      )}
      <div className="flex gap-4 text-sm">
        <Link href="/admin/quotes" className="underline">Manage Quotes</Link>
        <Link href="/admin/customers" className="underline">View Customers</Link>
      </div>
    </section>
  );
}
