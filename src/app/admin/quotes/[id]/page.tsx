"use client";

import { useParams } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { getQuoteStatusLabel, normalizeQuoteStatus, type QuoteStatusValue } from "@/lib/quote/constants";
import { formatMoney, formatUkDateTime, formatUkDateTimeFromParts, meaningfullyProvided } from "@/lib/formatting";

type Quote = {
  id: string;
  status: string;
  adminNotes?: string;
  adminCustomerMessage?: string;
  quotedPrice?: number;
  quotedCurrency: string;
  confirmedPrice?: number;
  confirmedCurrency?: string;
  quotedAt?: string;
  quoteExpiresAt?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  assignedDriverEmail?: string;
  assignedDriverPhotoUrl?: string;
  assignedVehicleMake?: string;
  assignedVehicleColour?: string;
  assignedVehicleRegistration?: string;
  assignedAt?: string;
  assignmentStatus?: "NOT_ASSIGNED" | "ASSIGNED" | "DETAILS_SENT" | "FAILED_TO_SEND";
  driverDetailsSentAt?: string;
  driverJobSentAt?: string;
  customerDriverEmailSentAt?: string;
  customerDriverSmsSentAt?: string;
  driverJobEmailSentAt?: string;
  driverJobSmsSentAt?: string;
  lastCommunicationError?: string;
  paymentStatus?: "NOT_REQUIRED" | "PAYMENT_REQUIRED" | "PAID" | "PAYMENT_FAILED" | "REFUNDED";
  paymentProvider?: "SQUARE";
  squarePaymentId?: string;
  squareOrderId?: string;
  paidAt?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentFailureReason?: string;
  serviceType: string;
  accountType: string;
  guestName?: string;
  guestEmail?: string;
  customerEmail?: string | null;
  customerProfileName?: string | null;
  guestPhone?: string;
  passengerName?: string;
  passengerPhone?: string;
  leadPassengerSameAsBooker?: boolean;
  leadPassengerName?: string;
  leadPassengerEmail?: string;
  leadPassengerPhone?: string;
  pickupLocation: string;
  pickupAddress?: string;
  dropoffLocation: string;
  dropoffAddress?: string;
  pickupDate: string;
  pickupTime: string;
  passengers: number;
  handLuggageCount?: number;
  suitcaseCount?: number;
  oversizeItemCount?: number;
  luggage?: string;
  golfBags?: number;
  returnJourney: boolean;
  returnJourneyNeeded?: boolean;
  returnPickup?: string;
  returnDropoff?: string;
  returnDate?: string;
  returnTime?: string;
  itineraryMessage?: string;
  estimatedFare?: number;
  finalEstimatedFare?: number;
  outwardEstimatedFare?: number;
  returnEstimatedFare?: number;
  returnDiscountPercent?: number;
  returnDiscountAmount?: number;
  estimatedCurrency?: string;
  estimatedDistanceMiles?: number;
  estimatedDurationMinutes?: number;
  estimatedFareBreakdown?: string;
  pricingSource?: string;
  requiresManualReview?: boolean;
  pricingCalculatedAt?: string;
  routeEstimateFailed?: boolean;
  routeEstimateFailureReason?: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  policyVersion?: string;
  createdAt: string;
  updatedAt: string;
};

type DriverOption = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  carMake: string;
  carModel?: string;
  carColour?: string;
  registrationNumber: string;
};

const ADMIN_STATUS_OPTIONS: Array<{ label: string; value: QuoteStatusValue }> = [
  { label: "Awaiting confirmation", value: "AWAITING_CONFIRMATION" },
  { label: "Quoted", value: "QUOTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function fieldRow(label: string, value: string, keySuffix?: string) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3" key={`${label}-${value}-${keySuffix || ""}`}>
      <p className="text-slate-500">{label}</p>
      <p className="sm:col-span-2 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function sectionCard(title: string, children: ReactNode) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm">{children}</div>
    </article>
  );
}

function buildBookerName(quote: Quote): string {
  if (meaningfullyProvided(quote.guestName)) return quote.guestName!.trim();
  if (meaningfullyProvided(quote.customerProfileName)) return quote.customerProfileName!.trim();
  const email = (quote.guestEmail || quote.customerEmail || "").trim();
  if (email.includes("@")) return email.split("@")[0] || "Not provided";
  return "Not provided";
}

export default function AdminQuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [notifyResult, setNotifyResult] = useState<{
    message: string;
    summary: {
      customerEmail: string;
      customerSms: string;
      driverEmail: string;
      driverSms: string;
      detailMessages: string[];
    };
  } | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    fetch(`/api/admin/quotes/${id}`, { cache: "no-store" }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to load quote");
        return;
      }
      setQuote(data.quote);
      setSelectedDriverId(data.quote?.assignedDriverId || "");
    }).catch(() => setError("Unable to load quote"));
  }, [params.id]);

  useEffect(() => {
    fetch("/api/admin/drivers?activeOnly=true", { cache: "no-store" }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(data.drivers) ? data.drivers as DriverOption[] : [];
      setDrivers(list.filter((d) => d.isActive));
    }).catch(() => undefined);
  }, []);

  const luggageLines = useMemo(() => {
    if (!quote) return [] as string[];
    const lines: string[] = [];
    const hand = quote.handLuggageCount ?? 0;
    const suit = quote.suitcaseCount ?? 0;
    const over = quote.oversizeItemCount ?? quote.golfBags ?? 0;
    if (hand > 0) lines.push(`Hand luggage: ${hand}`);
    if (suit > 0) lines.push(`Suitcases: ${suit}`);
    if (over > 0) lines.push(`Oversize items: ${over}`);
    return lines;
  }, [quote]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || saving) return;
    setSaving(true);
    setError("");
    setBanner(null);
    setNotifyResult(null);
    const fd = new FormData(event.currentTarget);
    const payload = {
      adminNotes: fd.get("adminNotes"),
      adminCustomerMessage: fd.get("adminCustomerMessage"),
      quotedPrice: fd.get("quotedPrice") ? Number(fd.get("quotedPrice")) : undefined,
      quotedCurrency: fd.get("quotedCurrency"),
      status: fd.get("status"),
      note: fd.get("note"),
    };

    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.message || "Update failed";
        setError(message);
        setBanner({ tone: "error", message });
        return;
      }
      setQuote(data.quote);
      if (data.emailAttempted && data.emailSent) {
        setBanner({ tone: "success", message: "Quote updated and sent to the customer." });
      } else if (data.emailAttempted && !data.emailSent) {
        setBanner({ tone: "warning", message: "Quote updated, but customer email could not be sent." });
      } else {
        setBanner({ tone: "success", message: "Quote updated." });
      }
    } catch {
      const message = "Update failed";
      setError(message);
      setBanner({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function action(actionName: "mark_awaiting" | "mark_quoted" | "mark_payment_required" | "mark_accepted" | "mark_declined" | "mark_cancelled") {
    if (!quote || saving) return;
    setSaving(true);
    setError("");
    setBanner(null);
    setNotifyResult(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, note: actionName.replace("_", " ") }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.message || "Action failed";
        setError(message);
        setBanner({ tone: "error", message });
        return;
      }
      setQuote(data.quote);
      setBanner({ tone: "success", message: "Quote updated." });
    } catch {
      const message = "Action failed";
      setError(message);
      setBanner({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  if (error && !quote) return <p className="text-red-700">{error}</p>;
  if (!quote) return <p>Loading...</p>;

  const currency = quote.confirmedCurrency || quote.quotedCurrency || quote.estimatedCurrency || "GBP";
  const normalizedStatus = normalizeQuoteStatus(quote.status);
  const displayStatus = normalizedStatus === "SUBMITTED" ? "Awaiting review" : getQuoteStatusLabel(normalizedStatus);
  const showReturn = Boolean(quote.returnJourney || quote.returnJourneyNeeded);
  const isPaid = quote.paymentStatus === "PAID";

  async function assignDriver() {
    if (!quote || !selectedDriverId || saving) return;
    setSaving(true);
    setError("");
    setBanner(null);
    setNotifyResult(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/assign-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: selectedDriverId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.message || "Could not assign driver.";
        setError(message);
        setBanner({ tone: "error", message });
        return;
      }
      setQuote(data.quote);
      setBanner({ tone: "success", message: "Driver assigned." });
    } catch {
      setError("Could not assign driver.");
      setBanner({ tone: "error", message: "Could not assign driver." });
    } finally {
      setSaving(false);
    }
  }

  async function sendDriverDetails() {
    if (!quote || saving) return;
    setSaving(true);
    setError("");
    setBanner(null);
    setNotifyResult(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/send-driver-details`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.message || "Could not send details.";
        setError(message);
        setBanner({ tone: "error", message });
        return;
      }
      setQuote(data.quote);
      setNotifyResult({ message: data.message, summary: data.notificationSummary });
      const hasFailed = ["failed"].some((status) => [
        data.notificationSummary?.customerEmail,
        data.notificationSummary?.customerSms,
        data.notificationSummary?.driverEmail,
        data.notificationSummary?.driverSms,
      ].includes(status));
      setBanner({
        tone: hasFailed ? "warning" : "success",
        message: data.message || (hasFailed ? "Some messages could not be sent. Please review below." : "Driver and customer details sent."),
      });
    } catch {
      setError("Could not send details.");
      setBanner({ tone: "error", message: "Could not send details." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Quote {quote.id.slice(0, 8).toUpperCase()}</h1>
      </header>

      {quote.paymentStatus === "PAID" ? (
        <article className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-sm">
          <h2 className="text-lg font-semibold">Payment received</h2>
          <p>Amount paid: {formatMoney(quote.paymentAmount ?? quote.confirmedPrice ?? quote.quotedPrice, quote.paymentCurrency || quote.confirmedCurrency || quote.quotedCurrency || "GBP")}</p>
          <p>Paid at: {quote.paidAt ? formatUkDateTime(quote.paidAt) : "Not available"}</p>
          <p>Square payment ID: {quote.squarePaymentId || "Not available"}</p>
        </article>
      ) : null}

      {banner ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${banner.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : banner.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          {banner.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {sectionCard("Quote summary", <>
          {fieldRow("Reference", quote.id.slice(0, 8).toUpperCase())}
          {fieldRow("Status", displayStatus)}
          {fieldRow("Created", formatUkDateTime(quote.createdAt))}
          {fieldRow("Updated", formatUkDateTime(quote.updatedAt))}
          {fieldRow("Confirmed price", formatMoney(quote.confirmedPrice ?? quote.quotedPrice, quote.confirmedCurrency || quote.quotedCurrency || "GBP"))}
          {(quote.finalEstimatedFare ?? quote.estimatedFare) !== undefined ? fieldRow("Estimated fare", formatMoney(quote.finalEstimatedFare ?? quote.estimatedFare, quote.estimatedCurrency || "GBP")) : null}
          {quote.paymentStatus ? fieldRow("Payment status", quote.paymentStatus.replaceAll("_", " ")) : null}
        </>)}

        {sectionCard("Booker / customer details", <>
          {fieldRow("Account type", quote.accountType)}
          {fieldRow("Customer name", buildBookerName(quote))}
          {fieldRow("Email", (quote.guestEmail || quote.customerEmail || "Not provided").trim() || "Not provided")}
          {fieldRow("Phone", quote.guestPhone?.trim() || "Not provided")}
        </>)}

        {sectionCard("Lead passenger", <>
          {fieldRow("Lead passenger same as booker", quote.leadPassengerSameAsBooker === false ? "No" : "Yes")}
          {quote.leadPassengerSameAsBooker === false ? (
            <>
              {fieldRow("Name", quote.leadPassengerName?.trim() || "Not provided")}
              {fieldRow("Email", quote.leadPassengerEmail?.trim() || "Not provided")}
              {fieldRow("Phone", quote.leadPassengerPhone?.trim() || "Not provided")}
            </>
          ) : fieldRow("Details", "Same as booker")}
        </>)}

        {sectionCard("Trip details", <>
          {fieldRow("Service type", quote.serviceType)}
          {fieldRow("Outward pickup", quote.pickupLocation || quote.pickupAddress || "Not provided")}
          {fieldRow("Outward drop-off", quote.dropoffLocation || quote.dropoffAddress || "Not provided")}
          {fieldRow("Outward date/time", formatUkDateTimeFromParts(quote.pickupDate, quote.pickupTime))}
          {fieldRow("Return journey", showReturn ? "Yes" : "No")}
          {showReturn ? (
            <>
              {fieldRow("Return pickup", quote.returnPickup?.trim() || "Not provided")}
              {fieldRow("Return drop-off", quote.returnDropoff?.trim() || "Not provided")}
              {fieldRow("Return date/time", formatUkDateTimeFromParts(quote.returnDate, quote.returnTime))}
            </>
          ) : null}
          {fieldRow("Passenger count", String(quote.passengers || 0))}
          {luggageLines.length > 0 ? luggageLines.map((line, index) => fieldRow(index === 0 ? "Luggage" : "", line)) : fieldRow("Luggage", "No luggage declared.")}
        </>)}

        {sectionCard("Special requests / itinerary", fieldRow("Message", quote.itineraryMessage?.trim() || "Not provided"))}

        {sectionCard("Pricing", <>
          {fieldRow("Estimated fare", formatMoney(quote.finalEstimatedFare ?? quote.estimatedFare, quote.estimatedCurrency || "GBP"))}
          {quote.outwardEstimatedFare !== undefined ? fieldRow("Outward estimate", formatMoney(quote.outwardEstimatedFare, quote.estimatedCurrency || "GBP")) : null}
          {showReturn && quote.returnEstimatedFare !== undefined ? fieldRow("Return estimate", formatMoney(quote.returnEstimatedFare, quote.estimatedCurrency || "GBP")) : null}
          {showReturn && (quote.returnDiscountPercent || 0) > 0 ? fieldRow("Return discount", `${quote.returnDiscountPercent}% (${formatMoney(quote.returnDiscountAmount || 0, quote.estimatedCurrency || "GBP")})`) : null}
          {quote.estimatedDistanceMiles !== undefined ? fieldRow("Estimated distance", `${quote.estimatedDistanceMiles} miles`) : null}
          {quote.estimatedDurationMinutes !== undefined ? fieldRow("Estimated duration", `${quote.estimatedDurationMinutes} minutes`) : null}
          {quote.pricingCalculatedAt ? fieldRow("Pricing calculated", formatUkDateTime(quote.pricingCalculatedAt)) : null}
          {quote.requiresManualReview ? fieldRow("Manual review", "Yes") : null}
          {quote.pricingSource === "MANUAL_GROUP_QUOTE" ? fieldRow("Manual group quote", "Yes") : null}
          {quote.routeEstimateFailed ? fieldRow("Route estimate failed", quote.routeEstimateFailureReason || "Unable to calculate route estimate") : null}
        </>)}

        {sectionCard("Terms / compliance", <>
          {fieldRow("Terms accepted", quote.termsAccepted ? "Yes" : "No")}
          {quote.termsAcceptedAt ? fieldRow("Accepted at", formatUkDateTime(quote.termsAcceptedAt)) : null}
          {quote.policyVersion ? fieldRow("Policy version", quote.policyVersion) : null}
        </>)}

        {sectionCard("Payment", <>
          {fieldRow("Confirmed price", formatMoney(quote.confirmedPrice ?? quote.quotedPrice, currency))}
          {quote.paymentStatus ? fieldRow("Payment status", quote.paymentStatus.replaceAll("_", " ")) : null}
          {quote.quoteExpiresAt ? fieldRow("Quote valid until", formatUkDateTime(quote.quoteExpiresAt)) : null}
          {quote.paidAt ? fieldRow("Paid at", formatUkDateTime(quote.paidAt)) : null}
          {quote.paymentAmount !== undefined ? fieldRow("Payment amount", formatMoney(quote.paymentAmount, quote.paymentCurrency || currency)) : null}
          {quote.squarePaymentId ? fieldRow("Square payment ID", quote.squarePaymentId) : null}
          {quote.paymentStatus === "PAYMENT_FAILED" && quote.paymentFailureReason ? fieldRow("Failure reason", quote.paymentFailureReason) : null}
        </>)}

        {sectionCard("Driver assignment", <>
          {fieldRow("Assignment status", quote.assignmentStatus || "NOT_ASSIGNED")}
          {fieldRow("Assigned driver", quote.assignedDriverName || "Not assigned")}
          {quote.assignedVehicleMake ? fieldRow("Assigned vehicle", `${quote.assignedVehicleMake}${quote.assignedVehicleRegistration ? ` • ${quote.assignedVehicleRegistration}` : ""}`) : null}
          {quote.assignedAt ? fieldRow("Assigned at", formatUkDateTime(quote.assignedAt)) : null}
          {quote.driverDetailsSentAt ? fieldRow("Customer details sent", formatUkDateTime(quote.driverDetailsSentAt)) : null}
          {quote.driverJobSentAt ? fieldRow("Driver job sent", formatUkDateTime(quote.driverJobSentAt)) : null}
          {quote.customerDriverEmailSentAt ? fieldRow("Customer email sent", formatUkDateTime(quote.customerDriverEmailSentAt)) : null}
          {quote.customerDriverSmsSentAt ? fieldRow("Customer SMS sent", formatUkDateTime(quote.customerDriverSmsSentAt)) : null}
          {quote.driverJobEmailSentAt ? fieldRow("Driver email sent", formatUkDateTime(quote.driverJobEmailSentAt)) : null}
          {quote.driverJobSmsSentAt ? fieldRow("Driver SMS sent", formatUkDateTime(quote.driverJobSmsSentAt)) : null}
          {quote.lastCommunicationError ? fieldRow("Last communication error", quote.lastCommunicationError) : null}

          {isPaid ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-sm font-medium text-slate-700">Select active driver</label>
              <select
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
              >
                <option value="">Choose driver…</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} • {driver.phone} • {[driver.carColour, driver.carMake, driver.carModel].filter(Boolean).join(" ")} {driver.registrationNumber ? `(${driver.registrationNumber})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving || !selectedDriverId} onClick={assignDriver} className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Assign driver</button>
                <button type="button" disabled={saving || !quote.assignedDriverId} onClick={sendDriverDetails} className="rounded bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Send driver/customer details</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">Driver assignment becomes available after payment is received.</p>
          )}
        </>)}
      </div>

      <form onSubmit={update} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <textarea name="adminNotes" defaultValue={quote.adminNotes || ""} placeholder="Admin notes" className="w-full rounded border border-slate-300 p-2" rows={4} />
        <textarea name="adminCustomerMessage" defaultValue={quote.adminCustomerMessage || ""} placeholder="Customer-visible message" className="w-full rounded border border-slate-300 p-2" rows={3} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="quotedPrice" type="number" step="0.01" defaultValue={quote.quotedPrice || ""} placeholder="Confirmed price" className="rounded border border-slate-300 px-3 py-2" />
          <input name="quotedCurrency" defaultValue={quote.quotedCurrency || "GBP"} placeholder="Currency" className="rounded border border-slate-300 px-3 py-2" />
          <select name="status" defaultValue={normalizeQuoteStatus(quote.status)} className="rounded border border-slate-300 px-3 py-2">
            {ADMIN_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <input name="note" placeholder="Audit note" className="w-full rounded border border-slate-300 px-3 py-2" />
        <button type="submit" disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Updating..." : "Update Quote"}</button>
      </form>

      <div className="flex flex-wrap gap-3">
        <button disabled={saving} onClick={() => action("mark_awaiting")} className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-60">Set Awaiting confirmation</button>
        <button disabled={saving} onClick={() => action("mark_quoted")} className="rounded bg-amber-600 px-4 py-2 text-white disabled:opacity-60">Set Quoted</button>
        <button disabled={saving} onClick={() => action("mark_payment_required")} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60">Set Payment Required</button>
        <button disabled={saving} onClick={() => action("mark_accepted")} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-60">Set Accepted</button>
        <button disabled={saving} onClick={() => action("mark_declined")} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-60">Set Declined</button>
        <button disabled={saving} onClick={() => action("mark_cancelled")} className="rounded bg-slate-500 px-4 py-2 text-white disabled:opacity-60">Set Cancelled</button>
      </div>

      {notifyResult ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h3 className="font-semibold text-slate-900">Notification results</h3>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <p>Customer email: {notifyResult.summary.customerEmail}</p>
            <p>Customer SMS: {notifyResult.summary.customerSms}</p>
            <p>Driver email: {notifyResult.summary.driverEmail}</p>
            <p>Driver SMS: {notifyResult.summary.driverSms}</p>
          </div>
          {notifyResult.summary.detailMessages.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
              {notifyResult.summary.detailMessages.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
