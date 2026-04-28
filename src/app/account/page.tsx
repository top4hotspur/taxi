"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Quote = { id: string; status: string; serviceType: string; pickupDate: string; pickupLocation: string; dropoffLocation: string; };

export default function AccountPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account/quotes").then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        setError("Please login as a customer to view account quotes.");
        return;
      }
      setQuotes(data.quotes || []);
    });
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">My Account</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">My Quotes</h2>
        <ul className="mt-4 space-y-3">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p><strong>{q.serviceType}</strong> - {q.status}</p>
              <p>{q.pickupDate} | {q.pickupLocation} to {q.dropoffLocation}</p>
              <Link href={`/account/quotes/${q.id}`} className="mt-2 inline-block underline">View quote</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
