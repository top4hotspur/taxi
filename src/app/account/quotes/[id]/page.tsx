"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getQuoteStatusLabel, normalizeQuoteStatus } from "@/lib/quote/constants";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import SquarePayQuoteForm from "@/components/SquarePayQuoteForm";
import { formatMoney, formatUkDateTime, formatUkDateTimeFromParts } from "@/lib/formatting";

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
  quotedPrice?: number;
  quotedCurrency?: string;
  confirmedPrice?: number;
  confirmedCurrency?: string;
  quotedAt?: string;
  quoteExpiresAt?: string;
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
  const [busyAction, setBusyAction] = useState<"pay" | "decline" | null>(null);
  const [localMessage, setLocalMessage] = useState<string>("");
  const [showPayForm, setShowPayForm] = useState(false);
  const [nowMs] = useState(() => Date.now());

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

  const canUseSquare = Boolean(process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID) && Boolean(process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID);

  const model = useMemo(() => {
    if (!quote) return null;
    const normalizedStatus = normalizeQuoteStatus(quote.status);
    const confirmedAmount = Number(quote.confirmedPrice ?? quote.quotedPrice);
    const confirmedCurrency = quote.confirmedCurrency || quote.quotedCurrency || "GBP";
    const isPaid = quote.paymentStatus === "PAID";
    const isQuotedAndPayable = Number.isFinite(confirmedAmount) && confirmedAmount > 0 && (normalizedStatus === "QUOTED" || quote.paymentStatus === "PAYMENT_REQUIRED");
    const expiresAt = quote.quoteExpiresAt ? new Date(quote.quoteExpiresAt) : null;
    const isExpired = Boolean(expiresAt && nowMs > 0 && expiresAt.getTime() < nowMs && !isPaid);
    return {
      normalizedStatus,
      confirmedAmount,
      confirmedCurrency,
      isPaid,
      isQuotedAndPayable,
      isExpired,
      expiresAt,
    };
  }, [quote, nowMs]);

  async function reload() {
    if (!quote) return;
    const res = await fetch(`/api/account/quotes/${quote.id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setQuote(data.quote as Quote);
  }

  async function declineQuote() {
    if (!quote || busyAction) return;
    setBusyAction("decline");
    setLocalMessage("");
    try {
      const res = await fetch(`/api/account/quotes/${quote.id}/decline`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not decline quote.");
        return;
      }
      setQuote(data.quote as Quote);
      setLocalMessage("You have declined this quote.");
    } catch {
      setError("Could not decline quote.");
    } finally {
      setBusyAction(null);
    }
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!quote || !model) return <p>Loading...</p>;

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Quote details</h1>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm space-y-2">
        <p><strong>Status:</strong> {getQuoteStatusLabel(quote.status)}</p>
        <p><strong>Service:</strong> {quote.serviceType}</p>
        <p><strong>Outward:</strong> {quote.pickupLocation} to {quote.dropoffLocation}</p>
        <p><strong>Outward date/time:</strong> {formatUkDateTimeFromParts(quote.pickupDate, quote.pickupTime)}</p>
        {(quote.returnJourney || quote.returnJourneyNeeded) ? (
          <>
            <p><strong>Return:</strong> {quote.returnPickup || "Not provided"} to {quote.returnDropoff || "Not provided"}</p>
            <p><strong>Return date/time:</strong> {formatUkDateTimeFromParts(quote.returnDate, quote.returnTime)}</p>
          </>
        ) : null}
        <p><strong>Passengers:</strong> {quote.passengers}</p>
        <p><strong>Special requests:</strong> {quote.itineraryMessage || "Not provided"}</p>
        <p><strong>Created:</strong> {formatUkDateTime(quote.createdAt)}</p>
        <p><strong>Updated:</strong> {formatUkDateTime(quote.updatedAt)}</p>
      </article>

      {model.isPaid ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 space-y-2">
          <p className="text-lg font-semibold">Payment received</p>
          <p>Paid amount: {formatMoney(quote.paymentAmount ?? model.confirmedAmount, quote.paymentCurrency || model.confirmedCurrency)}</p>
          <p>Paid at: {formatUkDateTime(quote.paidAt)}</p>
          <p>We&apos;ll confirm final driver/booking details shortly.</p>
        </article>
      ) : null}

      {!model.isPaid && model.isExpired ? (
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 space-y-2">
          <p className="font-semibold">This quote has expired.</p>
          <p>You can request an updated quote.</p>
          <a className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="/quote">Request updated quote</a>
        </article>
      ) : null}

      {!model.isPaid && !model.isExpired && model.isQuotedAndPayable ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm space-y-3">
          <p className="text-lg font-semibold">Your quote is ready</p>
          <p><strong>Confirmed quote:</strong> {formatMoney(model.confirmedAmount, model.confirmedCurrency)}</p>
          {quote.adminCustomerMessage ? <p><strong>Message from NI Taxi Co:</strong> {quote.adminCustomerMessage}</p> : null}
          <p>{quote.quoteExpiresAt ? `This quote is valid until ${formatUkDateTime(quote.quoteExpiresAt)}.` : "This quote is valid for 24 hours unless otherwise agreed."}</p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowPayForm((prev) => !prev)}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {showPayForm ? "Hide payment" : "Accept and Pay"}
            </button>
            <button
              type="button"
              disabled={busyAction === "decline"}
              onClick={declineQuote}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {busyAction === "decline" ? "Updating..." : "I no longer need this booking"}
            </button>
          </div>

          {showPayForm ? (
            canUseSquare ? (
              <SquarePayQuoteForm
                quoteId={quote.id}
                amount={model.confirmedAmount}
                currency={model.confirmedCurrency}
                onPaid={reload}
              />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                Online payment is not available right now. Please contact us to confirm your booking.
              </div>
            )
          ) : null}
        </article>
      ) : null}

      {!model.isPaid && !model.isExpired && !model.isQuotedAndPayable ? (
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          We&apos;re reviewing your quote and will update it shortly.
        </article>
      ) : null}

      {quote.paymentStatus === "PAYMENT_FAILED" && quote.paymentFailureReason ? (
        <article className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Last payment issue: {quote.paymentFailureReason}
        </article>
      ) : null}

      {localMessage ? <p className="text-sm text-emerald-700">{localMessage}</p> : null}
    </section>
  );
}
