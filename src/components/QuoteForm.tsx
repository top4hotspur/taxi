"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

const serviceTypes = ["Airport Transfer", "Golf Transfer", "Tourist Day Trip", "Event Transport", "Other"];
const pricingRelevantFields = new Set([
  "pickupLocation", "dropoffLocation", "pickupDate", "pickupTime", "passengers", "returnJourney",
  "returnPickupLocation", "returnDropoffLocation", "returnDate", "returnTime", "handLuggageCount", "suitcaseCount", "oversizeItemCount", "serviceType",
]);

type EstimateResponse = {
  ok: boolean;
  estimatedFare?: number | null;
  finalEstimatedFare?: number | null;
  outwardEstimatedFare?: number | null;
  returnEstimatedFare?: number | null;
  returnDiscountPercent?: number | null;
  returnDiscountAmount?: number | null;
  currency?: string;
  distanceMiles?: number | null;
  durationMinutes?: number | null;
  fareBreakdown?: Record<string, unknown> | null;
  pricingSource?: string;
  requiresManualReview?: boolean;
  routeEstimateFailed?: boolean;
  routeEstimateFailureReason?: string | null;
  customerMessage?: string;
  manualGroupQuote?: boolean;
};

export default function QuoteForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimateStale, setEstimateStale] = useState(false);
  const [returnJourneyNeeded, setReturnJourneyNeeded] = useState(false);
  const [leadPassengerSameAsBooker, setLeadPassengerSameAsBooker] = useState(true);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [customerContext, setCustomerContext] = useState({ loggedInCustomer: false, email: "", name: "", phone: "" });

  useEffect(() => {
    trackAnalyticsEvent("QUOTE_STARTED", "/quote");
    let active = true;
    fetch("/api/account/profile", { cache: "no-store" }).then(async (response) => {
      if (!response.ok || !active) return;
      const data = (await response.json()) as { ok?: boolean; user?: { email?: string; role?: string }; profile?: { name?: string; phone?: string } | null };
      if (!data.ok || data.user?.role !== "customer" || !active) return;
      setCustomerContext({
        loggedInCustomer: true,
        email: String(data.user?.email || "").trim(),
        name: String(data.profile?.name || "").trim(),
        phone: String(data.profile?.phone || "").trim(),
      });
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const canCalculate = (() => {
    const hasBase = Boolean((formState.pickupLocation || "").trim() && (formState.dropoffLocation || "").trim() && (formState.pickupDate || "").trim() && (formState.pickupTime || "").trim() && (formState.passengers || "").trim());
    if (!hasBase) return false;
    if (!returnJourneyNeeded) return true;
    return Boolean((formState.returnPickupLocation || "").trim() && (formState.returnDropoffLocation || "").trim() && (formState.returnDate || "").trim() && (formState.returnTime || "").trim());
  })();

  function markPotentiallyStale(fieldName: string) {
    if (!estimate || !pricingRelevantFields.has(fieldName)) return;
    if (!estimateStale) {
      setEstimateStale(true);
      trackAnalyticsEvent("QUOTE_ESTIMATE_STALE", "/quote");
    }
  }

  function resetReturnToReverse() {
    if (!formRef.current) return;
    const outwardPickup = formRef.current.querySelector<HTMLInputElement>('input[name="pickupLocation"]')?.value || "";
    const outwardDropoff = formRef.current.querySelector<HTMLInputElement>('input[name="dropoffLocation"]')?.value || "";
    const returnPickup = formRef.current.querySelector<HTMLInputElement>('input[name="returnPickupLocation"]');
    const returnDropoff = formRef.current.querySelector<HTMLInputElement>('input[name="returnDropoffLocation"]');
    if (returnPickup) returnPickup.value = outwardDropoff;
    if (returnDropoff) returnDropoff.value = outwardPickup;
    setFormState((current) => ({ ...current, returnPickupLocation: outwardDropoff, returnDropoffLocation: outwardPickup }));
  }

  async function calculateEstimate() {
    if (!formRef.current) return;
    setEstimating(true);
    setEstimateError("");
    const fd = new FormData(formRef.current);
    const payload = {
      pickupLocation: String(fd.get("pickupLocation") || ""),
      pickupPlaceId: String(fd.get("pickupPlaceId") || ""),
      pickupLat: String(fd.get("pickupLat") || ""),
      pickupLng: String(fd.get("pickupLng") || ""),
      dropoffLocation: String(fd.get("dropoffLocation") || ""),
      dropoffPlaceId: String(fd.get("dropoffPlaceId") || ""),
      dropoffLat: String(fd.get("dropoffLat") || ""),
      dropoffLng: String(fd.get("dropoffLng") || ""),
      returnJourney: returnJourneyNeeded ? "Yes" : "No",
      returnPickupLocation: String(fd.get("returnPickupLocation") || ""),
      returnPickupPlaceId: String(fd.get("returnPickupPlaceId") || ""),
      returnPickupLat: String(fd.get("returnPickupLat") || ""),
      returnPickupLng: String(fd.get("returnPickupLng") || ""),
      returnDropoffLocation: String(fd.get("returnDropoffLocation") || ""),
      returnDropoffPlaceId: String(fd.get("returnDropoffPlaceId") || ""),
      returnDropoffLat: String(fd.get("returnDropoffLat") || ""),
      returnDropoffLng: String(fd.get("returnDropoffLng") || ""),
      returnDate: String(fd.get("returnDate") || ""),
      returnTime: String(fd.get("returnTime") || ""),
      serviceType: String(fd.get("serviceType") || ""),
      pickupDate: String(fd.get("pickupDate") || ""),
      pickupTime: String(fd.get("pickupTime") || ""),
      passengers: String(fd.get("passengers") || ""),
      oversizeItemCount: String(fd.get("oversizeItemCount") || "0"),
      itineraryMessage: String(fd.get("itineraryMessage") || ""),
    };
    try {
      const response = await fetch("/api/pricing/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as EstimateResponse;
      if (!response.ok) throw new Error("Unable to calculate estimate right now.");
      setEstimate(result);
      setEstimateStale(false);
      trackAnalyticsEvent("QUOTE_ESTIMATE_RECALCULATED", "/quote");
      if (result.manualGroupQuote) {
        setEstimateError(result.customerMessage || "We can't estimate prices online for groups larger than 8 passengers. Please submit your request and we'll be in touch shortly with a tailored quote.");
      } else if (result.routeEstimateFailed) {
        setEstimateError(result.customerMessage || "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.");
      }
    } catch {
      setEstimateError("Unable to calculate estimate right now.");
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: customerContext.loggedInCustomer ? customerContext.name || String(fd.get("name") || "") : String(fd.get("name") || ""),
      email: customerContext.loggedInCustomer ? customerContext.email || String(fd.get("email") || "") : String(fd.get("email") || ""),
      phone: customerContext.loggedInCustomer ? customerContext.phone || String(fd.get("phone") || "") : String(fd.get("phone") || ""),
      passengerName: String(fd.get("passengerName") || ""),
      passengerPhone: String(fd.get("passengerPhone") || ""),
      leadPassengerSameAsBooker,
      leadPassengerName: leadPassengerSameAsBooker ? "" : String(fd.get("leadPassengerName") || ""),
      leadPassengerEmail: leadPassengerSameAsBooker ? "" : String(fd.get("leadPassengerEmail") || ""),
      leadPassengerPhone: leadPassengerSameAsBooker ? "" : String(fd.get("leadPassengerPhone") || ""),
      accountType: String(fd.get("accountType") || "PERSONAL"),
      serviceType: String(fd.get("serviceType") || ""),
      pickupLocation: String(fd.get("pickupLocation") || ""),
      pickupPlaceId: String(fd.get("pickupPlaceId") || ""),
      pickupAddress: String(fd.get("pickupAddress") || ""),
      pickupLat: String(fd.get("pickupLat") || ""),
      pickupLng: String(fd.get("pickupLng") || ""),
      dropoffLocation: String(fd.get("dropoffLocation") || ""),
      dropoffPlaceId: String(fd.get("dropoffPlaceId") || ""),
      dropoffAddress: String(fd.get("dropoffAddress") || ""),
      dropoffLat: String(fd.get("dropoffLat") || ""),
      dropoffLng: String(fd.get("dropoffLng") || ""),
      pickupDate: String(fd.get("pickupDate") || ""),
      pickupTime: String(fd.get("pickupTime") || ""),
      passengers: String(fd.get("passengers") || ""),
      handLuggageCount: String(fd.get("handLuggageCount") || "0"),
      suitcaseCount: String(fd.get("suitcaseCount") || "0"),
      oversizeItemCount: String(fd.get("oversizeItemCount") || "0"),
      returnJourney: returnJourneyNeeded ? "Yes" : "No",
      returnJourneyNeeded,
      returnPickup: String(fd.get("returnPickupLocation") || ""),
      returnPickupPlaceId: String(fd.get("returnPickupPlaceId") || ""),
      returnPickupAddress: String(fd.get("returnPickupAddress") || ""),
      returnPickupLat: String(fd.get("returnPickupLat") || ""),
      returnPickupLng: String(fd.get("returnPickupLng") || ""),
      returnDropoff: String(fd.get("returnDropoffLocation") || ""),
      returnDropoffPlaceId: String(fd.get("returnDropoffPlaceId") || ""),
      returnDropoffAddress: String(fd.get("returnDropoffAddress") || ""),
      returnDropoffLat: String(fd.get("returnDropoffLat") || ""),
      returnDropoffLng: String(fd.get("returnDropoffLng") || ""),
      returnDate: String(fd.get("returnDate") || ""),
      returnTime: String(fd.get("returnTime") || ""),
      itineraryMessage: String(fd.get("itineraryMessage") || ""),
      estimatedFare: estimate?.estimatedFare,
      finalEstimatedFare: estimate?.finalEstimatedFare,
      outwardEstimatedFare: estimate?.outwardEstimatedFare,
      returnEstimatedFare: estimate?.returnEstimatedFare,
      returnDiscountPercent: estimate?.returnDiscountPercent,
      returnDiscountAmount: estimate?.returnDiscountAmount,
      estimatedCurrency: estimate?.currency,
      estimatedDistanceMiles: estimate?.distanceMiles,
      estimatedDurationMinutes: estimate?.durationMinutes,
      estimatedFareBreakdown: estimate?.fareBreakdown ? JSON.stringify(estimate.fareBreakdown) : "",
      pricingSource: estimate?.pricingSource || "",
      requiresManualReview: Boolean(estimate?.requiresManualReview || estimateStale),
      pricingCalculatedAt: estimate ? new Date().toISOString() : "",
      routeEstimateFailed: Boolean(estimate?.routeEstimateFailed || estimateStale),
      routeEstimateFailureReason: String(estimateStale ? "Journey details changed after estimate." : estimate?.routeEstimateFailureReason || ""),
      termsAccepted: String(fd.get("termsAccepted") || "").toLowerCase() === "true",
      policyVersion: "v1-2026-05",
    };
    try {
      const response = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = await response.text();
      const result = text ? (JSON.parse(text) as { ok?: boolean; message?: string; error?: string; quoteId?: string }) : {};
      if (!response.ok) throw new Error(result.error || result.message || "Unable to submit quote request.");
      trackAnalyticsEvent("QUOTE_SUBMITTED", "/quote");
      router.push(result.quoteId ? `/quote/confirmation?quoteId=${encodeURIComponent(result.quoteId)}` : "/quote/confirmation");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit quote request.");
    }
  }

  const showNameField = !customerContext.loggedInCustomer || !customerContext.name;
  const showEmailField = !customerContext.loggedInCustomer || !customerContext.email;
  const showPhoneField = !customerContext.loggedInCustomer || !customerContext.phone;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChangeCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
        if (target.name === "returnJourney") setReturnJourneyNeeded(target.value === "Yes");
        if (target.name === "leadPassengerSameAsBooker") setLeadPassengerSameAsBooker(target.value === "Yes");
        if (target.name) {
          markPotentiallyStale(target.name);
          setFormState((current) => ({ ...current, [target.name]: target.value }));
        }
      }}
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Booker details</h2>
        {customerContext.loggedInCustomer && !showNameField && !showEmailField && !showPhoneField ? (
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold">Booking as {customerContext.name}</p>
            <p>{customerContext.email}</p>
            <p>{customerContext.phone}</p>
          </article>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          {showNameField && <InputField label="Booker name" name="name" required />}
          {showEmailField && <InputField label="Booker email" name="email" type="email" required />}
          {showPhoneField && <InputField label="Booker phone / WhatsApp" name="phone" required />}
          <InputField label="Passenger name (if different)" name="passengerName" />
          <InputField label="Passenger phone (if different)" name="passengerPhone" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Journey details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <PlaceAutocompleteInput label="Outward pickup location" required locationNameField="pickupLocation" placeIdField="pickupPlaceId" addressField="pickupAddress" latField="pickupLat" lngField="pickupLng" />
          <PlaceAutocompleteInput label="Outward drop-off location" required locationNameField="dropoffLocation" placeIdField="dropoffPlaceId" addressField="dropoffAddress" latField="dropoffLat" lngField="dropoffLng" />
          <InputField label="Outward date" name="pickupDate" type="date" required />
          <InputField label="Outward time" name="pickupTime" type="time" required />
          <SelectField label="Service type" name="serviceType" options={serviceTypes} required />
          <SelectField label="Account type" name="accountType" options={["PERSONAL", "BUSINESS"]} required />
          <SelectField label="Return journey needed? (Book return now and receive 10% off the combined fare)" name="returnJourney" options={["No", "Yes"]} required />
        </div>
      </section>

      {returnJourneyNeeded && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Return journey</h2>
          <p className="text-sm text-slate-600">We&apos;ll pre-fill the return route as the reverse of your outward journey. You can change it if needed.</p>
          <button type="button" onClick={resetReturnToReverse} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">Reset to reverse outward route</button>
          <div className="grid gap-5 sm:grid-cols-2">
            <PlaceAutocompleteInput label="Return pickup location" required locationNameField="returnPickupLocation" placeIdField="returnPickupPlaceId" addressField="returnPickupAddress" latField="returnPickupLat" lngField="returnPickupLng" defaultValueFieldName="dropoffLocation" />
            <PlaceAutocompleteInput label="Return drop-off location" required locationNameField="returnDropoffLocation" placeIdField="returnDropoffPlaceId" addressField="returnDropoffAddress" latField="returnDropoffLat" lngField="returnDropoffLng" defaultValueFieldName="pickupLocation" />
            <InputField label="Return date" name="returnDate" type="date" required />
            <InputField label="Return time" name="returnTime" type="time" required />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Luggage / passengers</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <InputField label="Number of passengers" name="passengers" type="number" min={1} required />
          <InputField label="Hand luggage" name="handLuggageCount" type="number" min={0} />
          <InputField label="Suitcases" name="suitcaseCount" type="number" min={0} />
          <div>
            <InputField label="Oversize items" name="oversizeItemCount" type="number" min={0} />
            <p className="mt-1 text-xs text-slate-500">For example golf clubs, skis, large boxes or mobility equipment.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Is the lead passenger the same person as the booker?" name="leadPassengerSameAsBooker" options={["Yes", "No"]} required />
          {!leadPassengerSameAsBooker ? (
            <>
              <InputField label="Lead passenger name" name="leadPassengerName" required />
              <InputField label="Lead passenger email address" name="leadPassengerEmail" type="email" required />
              <InputField label="Lead passenger phone number" name="leadPassengerPhone" required />
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Special requests</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor="itineraryMessage">Message / Itinerary / Special Requests</label>
          <textarea id="itineraryMessage" name="itineraryMessage" rows={5} placeholder="Add flight details, pickup instructions, child seats, accessibility needs, stop-offs, or anything else we should know." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Estimate</h2>
        <button type="button" onClick={calculateEstimate} disabled={estimating || !canCalculate} className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
          {estimating ? "Calculating..." : "Calculate estimated price"}
        </button>
        {estimateStale && <p className="text-sm font-medium text-amber-700">Journey details changed. Please recalculate before submitting.</p>}
        {estimateError && <p className="text-sm text-red-700">{estimateError}</p>}
        {estimate?.ok && (
          <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900">
            {estimate.manualGroupQuote ? (
              <p className="font-medium text-amber-900">We can&apos;t estimate prices online for groups larger than 8 passengers. Please submit your request and we&apos;ll be in touch shortly with a tailored quote.</p>
            ) : returnJourneyNeeded ? (
              <>
                <p className="text-lg font-semibold">Estimated return fare: {estimate.finalEstimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Outward journey: {estimate.outwardEstimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Return journey: {estimate.returnEstimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Return booking discount 10%: -{estimate.returnDiscountAmount ?? "N/A"} {estimate.currency || ""}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">Estimated fare: {estimate.finalEstimatedFare ?? estimate.estimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Distance: {estimate.distanceMiles ?? "N/A"} {estimate.distanceMiles !== null && estimate.distanceMiles !== undefined ? "miles" : ""}</p>
                <p>Journey time: {estimate.durationMinutes ?? "N/A"} {estimate.durationMinutes !== null && estimate.durationMinutes !== undefined ? "minutes" : ""}</p>
                <p>{estimate.fareBreakdown?.["airportSurchargeApplied"] ? "Airport surcharge included." : ""}</p>
                <p>{estimate.fareBreakdown?.["passengerUpliftPercent"] ? "Passenger uplift included." : ""}</p>
              </>
            )}
            <p className="mt-2 text-slate-700">Subject to driver availability and final confirmation.</p>
          </article>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" name="termsAccepted" value="true" required className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            I have read and agree to the <Link href="/terms" className="font-semibold underline" target="_blank">Terms &amp; Conditions</Link> and <Link href="/policies" className="font-semibold underline" target="_blank">Policies</Link>.
          </span>
        </label>
      </section>

      <button type="submit" disabled={status === "loading"} className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
        {status === "loading" ? "Submitting..." : "Submit Quote Request"}
      </button>
      {message && <p className="text-sm text-red-700">{message}</p>}
    </form>
  );
}

function InputField({ label, name, type = "text", required, min }: { label: string; name: string; type?: string; required?: boolean; min?: number }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} min={min} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2" />
    </div>
  );
}

function SelectField({ label, name, options, required }: { label: string; name: string; options: string[]; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>{label}</label>
      <select id={name} name={name} required={required} defaultValue={options[0] === "No" || options[0] === "Yes" ? options[0] : ""} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2">
        {options[0] !== "No" && options[0] !== "Yes" ? <option value="">Select an option</option> : null}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
