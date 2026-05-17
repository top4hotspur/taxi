"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { formatUkDateTime } from "@/lib/formatting";

type DriverListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string | null;
  carMake: string;
  carModel?: string;
  carColour?: string;
  registrationNumber: string;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadDrivers() {
    const res = await fetch("/api/admin/drivers", { cache: "no-store" });
    const data = (await res.json()) as { drivers?: DriverListItem[]; message?: string };
    if (!res.ok) {
      setError(data.message || "Unable to load drivers.");
      return;
    }
    setDrivers(data.drivers || []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/drivers", { cache: "no-store" });
        const data = (await res.json()) as { drivers?: DriverListItem[]; message?: string };
        if (!active) return;
        if (!res.ok) {
          setError(data.message || "Unable to load drivers.");
          return;
        }
        setDrivers(data.drivers || []);
      } catch {
        if (active) setError("Unable to load drivers.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function createDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    const fd = new FormData(event.currentTarget);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      photoUrl: String(fd.get("photoUrl") || "").trim(),
      carMake: String(fd.get("carMake") || "").trim(),
      carModel: String(fd.get("carModel") || "").trim(),
      carColour: String(fd.get("carColour") || "").trim(),
      registrationNumber: String(fd.get("registrationNumber") || "").trim(),
      isActive: fd.get("isActive") === "on",
    };

    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not create driver.");
        return;
      }
      (event.currentTarget as HTMLFormElement).reset();
      await loadDrivers();
    } catch {
      setError("Could not create driver.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Driver management</h1>

      <form onSubmit={createDriver} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Add driver</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Driver name" className="rounded border border-slate-300 px-3 py-2" />
          <input name="email" required type="email" placeholder="Driver email" className="rounded border border-slate-300 px-3 py-2" />
          <input name="phone" required placeholder="Driver telephone" className="rounded border border-slate-300 px-3 py-2" />
          <input name="photoUrl" placeholder="Driver photograph URL" className="rounded border border-slate-300 px-3 py-2" />
          <input name="carMake" required placeholder="Car make" className="rounded border border-slate-300 px-3 py-2" />
          <input name="carModel" placeholder="Car model" className="rounded border border-slate-300 px-3 py-2" />
          <input name="carColour" placeholder="Car colour" className="rounded border border-slate-300 px-3 py-2" />
          <input name="registrationNumber" required placeholder="Registration number" className="rounded border border-slate-300 px-3 py-2" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked /> Active
        </label>
        <div>
          <button disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Add driver"}</button>
        </div>
      </form>

      {error ? <p className="text-red-700 text-sm">{error}</p> : null}

      <ul className="space-y-3">
        {drivers.map((driver) => (
          <li key={driver.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {driver.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">No photo</div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">{driver.name}</p>
                <p>{driver.phone} • {driver.email}</p>
                <p>{[driver.carColour, driver.carMake, driver.carModel].filter(Boolean).join(" ")} • {driver.registrationNumber}</p>
                <p>Status: {driver.isActive ? "Active" : "Inactive"}</p>
                <p className="text-xs text-slate-500">Created {formatUkDateTime(driver.createdAt)} • Updated {formatUkDateTime(driver.updatedAt)}</p>
              </div>
              <Link href={`/admin/drivers/${driver.id}`} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
