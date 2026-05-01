"use client";

import { FormEvent, useRef, useState } from "react";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";

const serviceTypes = [
  "Airport transfer",
  "Golf transfer",
  "Tourist day trip",
  "Event transport",
  "Cruise/tour operator transport",
  "Corporate transfer",
  "Other",
];

type EstimateResponse = {
  ok: boolean;
  estimatedFare?: number | null;
  currency?: string;
  distanceMiles?: number | null;
  durationMinutes?: number | null;
  fareBreakdown?: Record<string, unknown> | null;
  pricingSource?: string;
  requiresManualReview?: boolean;
  routeEstimateFailed?: boolean;
  routeEstimateFailureReason?: string | null;
  customerMessage?: string;
  error?: string;
  errorCode?: string;
};

export default function QuoteForm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);

  async function calculateEstimate() {
    if (!formRef.current) return;
    setEstimating(true);
    setEstimateError("");

    const formData = new FormData(formRef.current);
    const payload = {
      pickupLocation: String(formData.get("pickupLocation") || ""),
      pickupPlaceId: String(formData.get("pickupPlaceId") || ""),
      pickupLat: String(formData.get("pickupLat") || ""),
      pickupLng: String(formData.get("pickupLng") || ""),
      dropoffLocation: String(formData.get("dropoffLocation") || ""),
      dropoffPlaceId: String(formData.get("dropoffPlaceId") || ""),
      dropoffLat: String(formData.get("dropoffLat") || ""),
      dropoffLng: String(formData.get("dropoffLng") || ""),
      serviceType: String(formData.get("serviceType") || ""),
      pickupDate: String(formData.get("pickupDate") || ""),
      pickupTime: String(formData.get("pickupTime") || ""),
      passengers: String(formData.get("passengers") || ""),
      luggage: String(formData.get("luggage") || ""),
      golfBags: String(formData.get("golfBags") || "0"),
      itineraryMessage: String(formData.get("itineraryMessage") || ""),
    };

    if (!payload.pickupLocation || !payload.dropoffLocation) {
      setEstimateError("Please enter pickup and drop-off locations first.");
      setEstimating(false);
      return;
    }

    try {
      const response = await fetch("/api/pricing/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as EstimateResponse;
      if (!response.ok) {
        setEstimateError("Unable to calculate estimate right now.");
        setEstimate(null);
        return;
      }
      setEstimate(result);
      if (result.routeEstimateFailed) {
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
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      accountType: String(formData.get("accountType") || "PERSONAL"),
      serviceType: String(formData.get("serviceType") || ""),
      pickupLocation: String(formData.get("pickupLocation") || ""),
      pickupPlaceId: String(formData.get("pickupPlaceId") || ""),
      pickupAddress: String(formData.get("pickupAddress") || ""),
      pickupLat: String(formData.get("pickupLat") || ""),
      pickupLng: String(formData.get("pickupLng") || ""),
      dropoffLocation: String(formData.get("dropoffLocation") || ""),
      dropoffPlaceId: String(formData.get("dropoffPlaceId") || ""),
      dropoffAddress: String(formData.get("dropoffAddress") || ""),
      dropoffLat: String(formData.get("dropoffLat") || ""),
      dropoffLng: String(formData.get("dropoffLng") || ""),
      pickupDate: String(formData.get("pickupDate") || ""),
      pickupTime: String(formData.get("pickupTime") || ""),
      passengers: String(formData.get("passengers") || ""),
      luggage: String(formData.get("luggage") || ""),
      golfBags: String(formData.get("golfBags") || "0"),
      returnJourney: String(formData.get("returnJourney") || "No"),
      itineraryMessage: String(formData.get("itineraryMessage") || ""),
      estimatedFare: estimate?.estimatedFare,
      estimatedCurrency: estimate?.currency,
      estimatedDistanceMiles: estimate?.distanceMiles,
      estimatedDurationMinutes: estimate?.durationMinutes,
      estimatedFareBreakdown: estimate?.fareBreakdown ? JSON.stringify(estimate.fareBreakdown) : "",
      pricingSource: estimate?.pricingSource || "",
      requiresManualReview: Boolean(estimate?.requiresManualReview),
      pricingCalculatedAt: estimate ? new Date().toISOString() : "",
      routeEstimateFailed: Boolean(estimate?.routeEstimateFailed),
      routeEstimateFailureReason: String(estimate?.routeEstimateFailureReason || ""),
    };

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();
      let result: { message?: string; error?: string; ok?: boolean; errorCode?: string; correlationId?: string } = {};
      if (bodyText) {
        try {
          result = JSON.parse(bodyText) as { message?: string; error?: string; ok?: boolean; errorCode?: string; correlationId?: string };
        } catch {
          result = {};
        }
      }
      if (!response.ok) {
        const details = [result.errorCode ? `Code: ${result.errorCode}` : "", result.correlationId ? `Ref: ${result.correlationId}` : ""]
          .filter(Boolean)
          .join(" | ");
        const suffix = details ? ` (${details})` : "";
        throw new Error((result.error || result.message || `Unable to submit quote request (status ${response.status}).`) + suffix);
      }

      setStatus("success");
      setMessage(result.message || "Quote submitted.");
      form.reset();
      setEstimate(null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField label="Name" name="name" required />
        <InputField label="Email" name="email" type="email" required />
        <InputField label="Phone / WhatsApp" name="phone" required />
        <SelectField label="Account type" name="accountType" options={["PERSONAL", "BUSINESS"]} required />
        <SelectField label="Service type" name="serviceType" options={serviceTypes} required />
        <InputField label="Number of passengers" name="passengers" type="number" min={1} required />
        <PlaceAutocompleteInput
          label="Pickup location"
          required
          locationNameField="pickupLocation"
          placeIdField="pickupPlaceId"
          addressField="pickupAddress"
          latField="pickupLat"
          lngField="pickupLng"
        />
        <PlaceAutocompleteInput
          label="Drop-off location"
          required
          locationNameField="dropoffLocation"
          placeIdField="dropoffPlaceId"
          addressField="dropoffAddress"
          latField="dropoffLat"
          lngField="dropoffLng"
        />
        <InputField label="Date" name="pickupDate" type="date" required />
        <InputField label="Time" name="pickupTime" type="time" required />
        <InputField label="Luggage" name="luggage" />
        <InputField label="Golf bags" name="golfBags" type="number" min={0} />
        <SelectField label="Return journey needed" name="returnJourney" options={["No", "Yes"]} required />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor="itineraryMessage">Message / itinerary</label>
        <textarea id="itineraryMessage" name="itineraryMessage" rows={5} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={calculateEstimate}
          disabled={estimating}
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {estimating ? "Calculating..." : "Calculate estimated price"}
        </button>

        {estimateError && <p className="text-sm text-red-700">{estimateError}</p>}

        {estimate?.ok && (
          <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900">
            <p className="text-lg font-semibold">
              Estimated price: {estimate.estimatedFare !== null && estimate.estimatedFare !== undefined ? `${estimate.estimatedFare} ${estimate.currency}` : "Manual review required"}
            </p>
            <p>Distance: {estimate.distanceMiles ?? "N/A"} {estimate.distanceMiles !== null && estimate.distanceMiles !== undefined ? "miles" : ""}</p>
            <p>Journey time: {estimate.durationMinutes ?? "N/A"} {estimate.durationMinutes !== null && estimate.durationMinutes !== undefined ? "minutes" : ""}</p>
            <p className="mt-2 text-slate-700">Subject to driver availability and final confirmation.</p>
            {estimate.routeEstimateFailed && (
              <p className="mt-2 font-medium text-slate-800">
                We could not calculate this route automatically. Submit your request and we will confirm the price manually.
              </p>
            )}
            {estimate.requiresManualReview && (
              <p className="mt-2 font-medium text-slate-800">
                This request requires manual review for final pricing (tours, golf groups, events, or complex itineraries).
              </p>
            )}
          </article>
        )}
      </div>

      <button type="submit" disabled={status === "loading"} className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
        {status === "loading" ? "Submitting..." : "Submit Quote Request"}
      </button>

      {message && <p className={`text-sm ${status === "success" ? "text-emerald-700" : "text-red-700"}`}>{message}</p>}
    </form>
  );
}

function InputField({ label, name, type = "text", required, min }: { label: string; name: string; type?: string; required?: boolean; min?: number; }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} min={min} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2" />
    </div>
  );
}

function SelectField({ label, name, options, required }: { label: string; name: string; options: string[]; required?: boolean; }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>{label}</label>
      <select id={name} name={name} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2">
        <option value="">Select an option</option>
        {options.map((option) => (<option key={option} value={option}>{option}</option>))}
      </select>
    </div>
  );
}
