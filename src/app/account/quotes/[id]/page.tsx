"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Quote = { id: string; status: string; serviceType: string; pickupLocation: string; dropoffLocation: string; quotedPrice?: string; quotedCurrency: string; itineraryMessage?: string; audits: Array<{ id: string; newStatus: string; note?: string; createdAt: string }>; };

export default function AccountQuoteDetail() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    fetch(`/api/account/quotes/${id}`).then(async (res) => {
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Unable to load quote."); return; }
      setQuote(data.quote);
    });
  }, [params.id]);

  async function act(action: "accept" | "decline") {
    if (!quote) return;
    const res = await fetch(`/api/account/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message || "Action failed"); return; }
    setQuote({ ...quote, status: data.quote.status });
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!quote) return <p>Loading...</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Quote {quote.id}</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm">
        <p>Status: <strong>{quote.status}</strong></p>
        <p>Service: {quote.serviceType}</p>
        <p>Route: {quote.pickupLocation} to {quote.dropoffLocation}</p>
        <p>Quoted: {quote.quotedPrice ? `${quote.quotedPrice} ${quote.quotedCurrency}` : "Pending"}</p>
        {quote.status === "QUOTE_SENT" && (
          <div className="mt-4 flex gap-3">
            <button onClick={() => act("accept")} className="rounded bg-emerald-600 px-4 py-2 text-white">Accept Quote</button>
            <button onClick={() => act("decline")} className="rounded bg-red-600 px-4 py-2 text-white">Decline Quote</button>
          </div>
        )}
      </div>
    </section>
  );
}
