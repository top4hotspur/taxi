"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatUkDateTime } from "@/lib/formatting";

type Driver = {
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

export default function AdminDriverDetailPage() {
  const params = useParams<{ id: string }>();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!params.id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/drivers/${params.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.message || "Unable to load driver.");
          return;
        }
        setDriver(data.driver);
      } catch {
        if (active) setError("Unable to load driver.");
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driver || saving) return;
    setSaving(true);
    setError("");
    setSaved("");

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
      const res = await fetch(`/api/admin/drivers/${driver.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to update driver.");
        return;
      }
      setDriver(data.driver);
      setSaved("Driver updated.");
    } catch {
      setError("Unable to update driver.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !driver) return <p className="text-red-700">{error}</p>;
  if (!driver) return <p>Loading...</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Edit driver</h1>

      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {driver.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">No photo</div>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <p><strong>{driver.name}</strong></p>
            <p>{driver.phone} • {driver.email}</p>
            <p>{[driver.carColour, driver.carMake, driver.carModel].filter(Boolean).join(" ")} • {driver.registrationNumber}</p>
            <p>Status: {driver.isActive ? "Active" : "Inactive"}</p>
            <p className="text-xs text-slate-500">Created {formatUkDateTime(driver.createdAt)} • Updated {formatUkDateTime(driver.updatedAt)}</p>
          </div>
        </div>
      </article>

      <form onSubmit={onSave} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required defaultValue={driver.name} placeholder="Driver name" className="rounded border border-slate-300 px-3 py-2" />
          <input name="email" required type="email" defaultValue={driver.email} placeholder="Driver email" className="rounded border border-slate-300 px-3 py-2" />
          <input name="phone" required defaultValue={driver.phone} placeholder="Driver telephone" className="rounded border border-slate-300 px-3 py-2" />
          <input name="photoUrl" defaultValue={driver.photoUrl || ""} placeholder="Driver photograph URL" className="rounded border border-slate-300 px-3 py-2" />
          <input name="carMake" required defaultValue={driver.carMake} placeholder="Car make" className="rounded border border-slate-300 px-3 py-2" />
          <input name="carModel" defaultValue={driver.carModel || ""} placeholder="Car model" className="rounded border border-slate-300 px-3 py-2" />
          <input name="carColour" defaultValue={driver.carColour || ""} placeholder="Car colour" className="rounded border border-slate-300 px-3 py-2" />
          <input name="registrationNumber" required defaultValue={driver.registrationNumber} placeholder="Registration number" className="rounded border border-slate-300 px-3 py-2" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={driver.isActive} /> Active
        </label>
        <div className="flex items-center gap-3">
          <button disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Save driver"}</button>
          {saved ? <p className="text-sm text-emerald-700">{saved}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
