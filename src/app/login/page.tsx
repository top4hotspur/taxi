"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type LoginMode = "customer" | "driver" | "admin";

interface LoginViewProps {
  mode?: LoginMode;
}

const copyByMode: Record<LoginMode, { title: string; registerHref: string; registerText: string; help?: string }> = {
  customer: {
    title: "Customer Login",
    registerHref: "/customer/register",
    registerText: "Create a customer account",
  },
  driver: {
    title: "Driver Login",
    registerHref: "/driver/register",
    registerText: "Driver onboarding details",
    help: "Driver onboarding and document verification are being prepared.",
  },
  admin: {
    title: "Admin Login",
    registerHref: "/customer/register",
    registerText: "Back to customer registration",
  },
};

export default function LoginPage() {
  return <LoginView mode="customer" />;
}

export function LoginView({ mode = "customer" }: LoginViewProps) {
  const [error, setError] = useState("");
  const copy = copyByMode[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fd = new FormData(event.currentTarget);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Login failed");
      return;
    }

    if (mode === "driver") {
      window.location.href = "/driver";
      return;
    }

    if (mode === "admin") {
      window.location.href = "/admin";
      return;
    }

    window.location.href = data.role === "ADMIN" ? "/admin" : "/account";
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-bold">{copy.title}</h1>
      {copy.help && <p className="mt-2 text-sm text-slate-600">{copy.help}</p>}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-white">Login</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-4 text-sm"><Link href={copy.registerHref} className="underline">{copy.registerText}</Link></p>
    </section>
  );
}
