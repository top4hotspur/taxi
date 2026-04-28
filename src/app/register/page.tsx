"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  return <RegisterView mode="customer" />;
}

export function RegisterView({ mode = "customer" }: { mode?: "customer" | "driver" }) {
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "driver") {
      return;
    }

    const fd = new FormData(event.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Registration failed");
      return;
    }

    window.location.href = "/account";
  }

  if (mode === "driver") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-bold">Driver Register</h1>
        <p className="mt-3 text-slate-700">
          Driver onboarding, document verification, and availability setup are coming in the next phase.
        </p>
        <p className="mt-2 text-slate-700">
          For now, please use Driver Login if you were invited for testing.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-bold">Create Customer Account</h1>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input label="Email" name="email" type="email" required />
        <Input label="Password" name="password" type="password" required />
        <Select label="Account Type" name="accountType" options={["PERSONAL", "BUSINESS"]} required />
        <Input label="Name" name="name" required />
        <Input label="Phone / WhatsApp" name="phone" required />
        <Input label="Country" name="country" required />
        <Input label="Address line 1" name="addressLine1" required />
        <Input label="Address line 2" name="addressLine2" />
        <Input label="City" name="city" required />
        <Input label="Region/State/Province" name="region" required />
        <Input label="Postal code/ZIP" name="postalCode" required />
        <Input label="Address country" name="addressCountry" required />
        <Input label="Business name" name="businessName" />
        <Input label="Tour operator name" name="tourOperatorName" />
        <Input label="Website" name="website" />
        <Input label="Tax ID / VAT number" name="taxIdVatNumber" />
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

function Select({ label, name, options, required = false }: { label: string; name: string; options: string[]; required?: boolean }) {
  return <div><label className="mb-1 block text-sm">{label}</label><select name={name} required={required} className="w-full rounded-lg border border-slate-300 px-3 py-2">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}
