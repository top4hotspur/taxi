"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Quote = {
  id: string;
  status: string;
  adminNotes?: string;
  quotedPrice?: number;
  quotedCurrency: string;
  serviceType: string;
  accountType: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  pickupLocation: string;
  pickupPlaceId?: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLocation: string;
  dropoffPlaceId?: string;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupDate: string;
  pickupTime: string;
  passengers: number;
  luggage?: string;
  golfBags?: number;
  returnJourney: boolean;
  itineraryMessage?: string;
  estimatedFare?: number;
  estimatedCurrency?: string;
  estimatedDistanceMiles?: number;
  estimatedDurationMinutes?: number;
  estimatedFareBreakdown?: string;
  pricingSource?: string;
  requiresManualReview?: boolean;
  pricingCalculatedAt?: string;
  audits: Array<{ id: string; newStatus: string; note?: string; createdAt: string }>;
};

export default function AdminQuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    fetch(`/api/admin/quotes/${id}`).then(async (res) => {
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Unable to load quote"); return; }
      setQuote(data.quote);
    });
  }, [params.id]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;
    const fd = new FormData(event.currentTarget);
    const payload = {
      adminNotes: fd.get("adminNotes"),
      quotedPrice: fd.get("quotedPrice") ? Number(fd.get("quotedPrice")) : undefined,
      quotedCurrency: fd.get("quotedCurrency"),
      status: fd.get("status"),
      note: fd.get("note"),
    };

    const res = await fetch(`/api/admin/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message || "Update failed"); return; }
    setQuote({ ...quote, ...data.quote });
  }

  async function action(actionName: "mark_updated" | "mark_sent" | "create_booking" | "confirm_booking") {
    if (!quote) return;
    const res = await fetch(`/api/admin/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName, note: actionName.replace("_", " ") }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message || "Action failed"); return; }
    setQuote({ ...quote, ...data.quote });
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!quote) return <p>Loading...</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Quote {quote.id}</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p>Status: <strong>{quote.status}</strong></p>
        <p>Account type: {quote.accountType}</p>
        <p>Name: {quote.guestName || "Account customer"}</p>
        <p>Email: {quote.guestEmail || "From customer account"}</p>
        <p>Phone: {quote.guestPhone || "Not provided"}</p>
        <p>Service: {quote.serviceType}</p>
        <p>Date/Time: {quote.pickupDate} {quote.pickupTime}</p>
        <p>Passengers: {quote.passengers}</p>
        <p>Luggage: {quote.luggage || "Not provided"}</p>
        <p>Golf bags: {quote.golfBags ?? 0}</p>
        <p>Return journey: {quote.returnJourney ? "Yes" : "No"}</p>
        <p>Itinerary: {quote.itineraryMessage || "Not provided"}</p>
        <p>Pickup: {quote.pickupLocation}</p>
        <p>Pickup address: {quote.pickupAddress || "Not provided"}</p>
        <p>Pickup place ID: {quote.pickupPlaceId || "Not provided"}</p>
        <p>Pickup coordinates: {quote.pickupLat !== undefined && quote.pickupLng !== undefined ? `${quote.pickupLat}, ${quote.pickupLng}` : "Not provided"}</p>
        <p>Drop-off: {quote.dropoffLocation}</p>
        <p>Drop-off address: {quote.dropoffAddress || "Not provided"}</p>
        <p>Drop-off place ID: {quote.dropoffPlaceId || "Not provided"}</p>
        <p>Drop-off coordinates: {quote.dropoffLat !== undefined && quote.dropoffLng !== undefined ? `${quote.dropoffLat}, ${quote.dropoffLng}` : "Not provided"}</p>
        <hr className="my-3 border-slate-200" />
        <p>Pricing source: {quote.pricingSource || "None"}</p>
        <p>Estimated fare: {quote.estimatedFare !== undefined ? `${quote.estimatedFare} ${quote.estimatedCurrency || "GBP"}` : "Not available"}</p>
        <p>Estimated distance: {quote.estimatedDistanceMiles !== undefined ? `${quote.estimatedDistanceMiles} miles` : "Not available"}</p>
        <p>Estimated duration: {quote.estimatedDurationMinutes !== undefined ? `${quote.estimatedDurationMinutes} minutes` : "Not available"}</p>
        <p>Requires manual review: {quote.requiresManualReview ? "Yes" : "No"}</p>
        <p>Pricing calculated at: {quote.pricingCalculatedAt || "Not available"}</p>
        <p>Fare breakdown: {quote.estimatedFareBreakdown || "Not available"}</p>
      </div>

      <form onSubmit={update} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <textarea name="adminNotes" defaultValue={quote.adminNotes || ""} placeholder="Admin notes" className="w-full rounded border border-slate-300 p-2" rows={4} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="quotedPrice" type="number" step="0.01" defaultValue={quote.quotedPrice || ""} placeholder="Quoted price" className="rounded border border-slate-300 px-3 py-2" />
          <input name="quotedCurrency" defaultValue={quote.quotedCurrency || "GBP"} placeholder="Currency" className="rounded border border-slate-300 px-3 py-2" />
          <select name="status" defaultValue={quote.status} className="rounded border border-slate-300 px-3 py-2">
            {["QUOTE_REQUESTED","QUOTE_UPDATED","QUOTE_SENT","QUOTE_ACCEPTED","QUOTE_DECLINED","QUOTE_IGNORED","BOOKING_CREATED","BOOKING_CONFIRMED","BOOKING_CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <input name="note" placeholder="Audit note" className="w-full rounded border border-slate-300 px-3 py-2" />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">Update Quote</button>
      </form>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => action("mark_updated")} className="rounded bg-slate-700 px-4 py-2 text-white">Mark Quote Updated</button>
        <button onClick={() => action("mark_sent")} className="rounded bg-amber-600 px-4 py-2 text-white">Mark Quote Sent</button>
        <button onClick={() => action("create_booking")} className="rounded bg-blue-700 px-4 py-2 text-white">Create Booking</button>
        <button onClick={() => action("confirm_booking")} className="rounded bg-emerald-700 px-4 py-2 text-white">Confirm Booking</button>
      </div>
    </section>
  );
}
