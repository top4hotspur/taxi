"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getQuoteStatusLabel } from "@/lib/quote/constants";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import SquarePayQuoteForm from "@/components/SquarePayQuoteForm";

type Quote = {
  id: string;
  status: string;
  serviceType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnJourney?: boolean;
  returnJourneyNeeded?: boolean;
  returnPickup?: string;
  returnDropoff?: string;
  returnDate?: string;
  returnTime?: string;
  passengers: number;
  handLuggageCount?: number;
  suitcaseCount?: number;
  oversizeItemCount?: number;
  itineraryMessage?: string;
  leadPassengerSameAsBooker?: boolean;
  leadPassengerName?: string;
  leadPassengerEmail?: string;
  leadPassengerPhone?: string;
  estimatedFare?: number;
  finalEstimatedFare?: number;
  estimatedCurrency?: string;
  estimatedFareBreakdown?: string;
  quotedPrice?: number;
  quotedCurrency?: string;
  confirmedPrice?: number;
  confirmedCurrency?: string;
  paymentStatus?: "NOT_REQUIRED" | "PAYMENT_REQUIRED" | "PAID" | "PAYMENT_FAILED" | "REFUNDED";
  paymentProvider?: "SQUARE";
  squarePaymentId?: string;
  paidAt?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentFailureReason?: string;
  adminCustomerMessage?: string;
  termsAccepted?: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AccountQuoteDetail() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQuote() {
      const id = params.id;
      if (!id) return;
      const res = await fetch(`/api/account/quotes/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to load quote.");
        return;
      }
      setQuote(data.quote as Quote);
    }

    const id = params.id;
    if (!id) return;
    trackAnalyticsEvent("ACCOUNT_QUOTE_DETAIL_VIEWED", `/account/quotes/${id}`);
    loadQuote().catch(() => setError("Unable to load quote."));
  }, [params.id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!quote) return <p>Loading...</p>;
  const confirmedAmount = Number(quote.confirmedPrice ?? quote.quotedPrice);
  const confirmedCurrency = quote.confirmedCurrency || quote.quotedCurrency || "GBP";
  const paymentReady = Number.isFinite(confirmedAmount) && confirmedAmount > 0 && quote.paymentStatus === "PAYMENT_REQUIRED";
  const isPaid = quote.paymentStatus === "PAID";

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Quote details</h1>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm space-y-1">
        <p><strong>Status:</strong> {getQuoteStatusLabel(quote.status)}</p>
        <p><strong>Service:</strong> {quote.serviceType}</p>
        <p><strong>Outward journey:</strong> {quote.pickupLocation} to {quote.dropoffLocation}</p>
        <p><strong>Outward date/time:</strong> {quote.pickupDate} {quote.pickupTime}</p>
        {(quote.returnJourney || quote.returnJourneyNeeded) && (
          <>
            <p><strong>Return journey:</strong> {quote.returnPickup || "Not provided"} to {quote.returnDropoff || "Not provided"}</p>
            <p><strong>Return date/time:</strong> {quote.returnDate || "Not provided"} {quote.returnTime || ""}</p>
          </>
        )}
        <p><strong>Passengers:</strong> {quote.passengers}</p>
        <p><strong>Hand luggage:</strong> {quote.handLuggageCount ?? 0}</p>
        <p><strong>Suitcases:</strong> {quote.suitcaseCount ?? 0}</p>
        <p><strong>Oversize items:</strong> {quote.oversizeItemCount ?? 0}</p>
        <p><strong>Special requests:</strong> {quote.itineraryMessage || "None"}</p>
        <p><strong>Lead passenger same as booker:</strong> {quote.leadPassengerSameAsBooker === false ? "No" : "Yes"}</p>
        {quote.leadPassengerSameAsBooker === false ? (
          <>
            <p><strong>Lead passenger name:</strong> {quote.leadPassengerName || "Not provided"}</p>
            <p><strong>Lead passenger email:</strong> {quote.leadPassengerEmail || "Not provided"}</p>
            <p><strong>Lead passenger phone:</strong> {quote.leadPassengerPhone || "Not provided"}</p>
          </>
        ) : null}
        <p><strong>Estimated fare:</strong> {(quote.finalEstimatedFare ?? quote.estimatedFare) ? `${quote.finalEstimatedFare ?? quote.estimatedFare} ${quote.estimatedCurrency || "GBP"}` : "Manual review required"}</p>
        {quote.quotedPrice !== undefined && quote.quotedPrice !== null && (
          <p><strong>Confirmed quote:</strong> {quote.quotedPrice} {quote.quotedCurrency || "GBP"}</p>
        )}
        <p><strong>Payment status:</strong> {quote.paymentStatus || "NOT_REQUIRED"}</p>
        {isPaid ? (
          <>
            <p><strong>Paid amount:</strong> {(quote.paymentAmount ?? confirmedAmount).toFixed(2)} {quote.paymentCurrency || confirmedCurrency}</p>
            <p><strong>Paid at:</strong> {quote.paidAt ? new Date(quote.paidAt).toLocaleString() : "Not available"}</p>
            <p><strong>Payment reference:</strong> {quote.squarePaymentId || "Not available"}</p>
          </>
        ) : null}
        {quote.paymentStatus === "PAYMENT_FAILED" && quote.paymentFailureReason ? (
          <p><strong>Last payment issue:</strong> {quote.paymentFailureReason}</p>
        ) : null}
        {quote.adminCustomerMessage && <p><strong>Message from NI Taxi Co:</strong> {quote.adminCustomerMessage}</p>}
        <p><strong>Terms accepted:</strong> {quote.termsAccepted ? "Yes" : "No"}</p>
        <p><strong>Created:</strong> {new Date(quote.createdAt).toLocaleString()}</p>
        <p><strong>Updated:</strong> {new Date(quote.updatedAt).toLocaleString()}</p>
      </article>
      {paymentReady ? (
        <SquarePayQuoteForm
          quoteId={quote.id}
          amount={confirmedAmount}
          currency={confirmedCurrency}
          onPaid={() => {
            fetch(`/api/account/quotes/${quote.id}`, { cache: "no-store" })
              .then(async (res) => {
                const data = await res.json();
                if (res.ok) setQuote(data.quote as Quote);
              })
              .catch(() => undefined);
          }}
        />
      ) : null}
      {!paymentReady && !isPaid ? (
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          We&apos;re reviewing your quote and will update it shortly.
        </article>
      ) : null}
    </section>
  );
}
