"use client";

import { FormEvent, useState } from "react";

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
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Unable to submit quote request.");
      }

      setStatus("success");
      setMessage("Thank you. Your quote enquiry has been received and we will reply shortly.");
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
        <InputField label="Country" name="country" required />
        <SelectField label="Service type" name="serviceType" options={serviceTypes} required />
        <InputField label="Number of passengers" name="passengers" type="number" min={1} required />
        <InputField label="Pickup location" name="pickup" required />
        <InputField label="Drop-off location" name="dropoff" required />
        <InputField label="Date" name="date" type="date" required />
        <InputField label="Time" name="time" type="time" required />
        <InputField label="Luggage / golf bags" name="luggage" />
        <SelectField label="Return journey needed" name="returnJourney" options={["No", "Yes"]} required />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor="message">
          Message / itinerary
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2"
          placeholder="Share trip details, flight numbers, course list, or timing notes."
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="consent" value="yes" required className="mt-1" />
        <span>I consent to NI Taxi Co using this information to respond to my enquiry.</span>
      </label>

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {status === "loading" ? "Submitting..." : "Submit Quote Request"}
      </button>

      {message && (
        <p className={`text-sm ${status === "success" ? "text-emerald-700" : "text-red-700"}`}>{message}</p>
      )}
    </form>
  );
}

interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
}

function InputField({ label, name, type = "text", required, min }: InputFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        min={min}
        required={required}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2"
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}

function SelectField({ label, name, options, required }: SelectFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2"
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
