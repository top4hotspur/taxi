"use client";

import { FormEvent, useState } from "react";

const countryOptions = [
  "United Kingdom",
  "Ireland",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Switzerland",
  "United Arab Emirates",
  "India",
  "South Africa",
  "Other",
];

export default function RegisterPage() {
  return <RegisterView mode="customer" />;
}

export function RegisterView({ mode = "customer" }: { mode?: "customer" | "driver" }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountType, setAccountType] = useState<"PERSONAL" | "BUSINESS">("PERSONAL");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const fd = new FormData(event.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    const endpoint = mode === "driver" ? "/api/auth/register-driver" : "/api/auth/register";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Registration failed");
      return;
    }

    if (mode === "driver") {
      setMessage("Driver profile saved. Please continue with Driver Login and upload documents.");
      event.currentTarget.reset();
      return;
    }

    window.location.href = "/account";
  }

  if (mode === "driver") {
    return (
      <section className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-bold">Driver Register</h1>
        <p className="mt-2 text-slate-700">Complete your driver profile. Document upload and review continues in the driver portal.</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Input label="Name" name="name" required />
          <Input label="Email" name="email" type="email" required />
          <Input label="Password" name="password" type="password" required />
          <Input label="Mobile" name="mobile" required />
          <Input label="Address line 1" name="addressLine1" required />
          <Input label="Address line 2" name="addressLine2" />
          <Input label="City" name="city" required />
          <Input label="Region" name="region" required />
          <Input label="Postal code" name="postalCode" required />
          <Input label="Country" name="country" required />
          <Input label="Car make" name="carMake" required />
          <Input label="Car model" name="carModel" required />
          <Input label="Registration number" name="registrationNumber" required />
          <Input label="Passenger capacity" name="passengerCapacity" type="number" required />
          <Input label="Suitcase capacity" name="suitcaseCapacity" type="number" required />
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-white">Register Driver</button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-bold">Create Customer Account</h1>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input label="Email" name="email" type="email" required />
        <Input label="Password" name="password" type="password" required />
        <Select
          label="Account Type"
          name="accountType"
          options={["PERSONAL", "BUSINESS"]}
          required
          value={accountType}
          onChange={(value) => setAccountType(value as "PERSONAL" | "BUSINESS")}
        />
        <Input label="Name" name="name" required />
        <Input label="Phone / WhatsApp" name="phone" required />
        <Select label="Country" name="country" options={countryOptions} required defaultValue="United Kingdom" />
        <Input label="Address line 1" name="addressLine1" required />
        <Input label="Address line 2" name="addressLine2" />
        <Input label="City" name="city" required />
        <Input label="Region/State/Province" name="region" required />
        <Input label="Postal code/ZIP" name="postalCode" required />
        <Select label="Address country" name="addressCountry" options={countryOptions} required defaultValue="United Kingdom" />

        {accountType === "BUSINESS" && (
          <>
            <Input label="Business name" name="businessName" />
            <Input label="Tour operator name" name="tourOperatorName" />
            <Input label="Website" name="website" />
            <Input label="Tax ID / VAT number" name="taxIdVatNumber" />
          </>
        )}

        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-white">Register</button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function Input({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div><label className="mb-1 block text-sm">{label}</label><input name={name} type={type} required={required} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></div>;
}

function Select({
  label,
  name,
  options,
  required = false,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm">{label}</label>
      <select
        name={name}
        required={required}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
