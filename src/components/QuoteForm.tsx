"use client";

import { FormEvent, useState } from "react";
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

export default function QuoteForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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
    };

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();
      let result: { message?: string; error?: string; ok?: boolean } = {};
      if (bodyText) {
        try {
          result = JSON.parse(bodyText) as { message?: string; error?: string; ok?: boolean };
        } catch {
          result = {};
        }
      }
      if (!response.ok) {
        throw new Error(result.error || result.message || `Unable to submit quote request (status ${response.status}).`);
      }

      setStatus("success");
      setMessage(result.message || "Quote submitted.");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
