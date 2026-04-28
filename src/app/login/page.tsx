"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");

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

    window.location.href = data.role === "ADMIN" ? "/admin" : "/account";
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-bold">Login</h1>
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
      <p className="mt-4 text-sm">New customer? <Link href="/register" className="underline">Create an account</Link></p>
    </section>
  );
}
