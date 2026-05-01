"use client";

import { useEffect, useState } from "react";

type TimeUplift = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  upliftPercent: number;
  active: boolean;
};

type DateUplift = {
  id: string;
  label: string;
  upliftPercent: number;
  active: boolean;
  ruleType: "SINGLE_DATE" | "DATE_RANGE" | "RECURRING_ANNUAL_DATE";
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type Settings = {
  id?: string;
  baseFare: number;
  perMile: number;
  perMinute: number;
  minimumFare: number;
  currency: string;
  airportUpliftPercent?: number;
  dublinAirportUpliftPercent?: number;
  golfBagSurcharge?: number;
  largeLuggageSurcharge?: number;
  active: boolean;
};

const defaultSettings: Settings = {
  baseFare: 10,
  perMile: 2.2,
  perMinute: 0.35,
  minimumFare: 25,
  currency: "GBP",
  airportUpliftPercent: 0,
  dublinAirportUpliftPercent: 0,
  golfBagSurcharge: 0,
  largeLuggageSurcharge: 0,
  active: true,
};

const defaultTimeBands: TimeUplift[] = [
  { id: "band-1", label: "00:01-06:00", startTime: "00:01", endTime: "06:00", upliftPercent: 0, active: false },
  { id: "band-2", label: "06:01-12:00", startTime: "06:01", endTime: "12:00", upliftPercent: 0, active: false },
  { id: "band-3", label: "12:01-18:00", startTime: "12:01", endTime: "18:00", upliftPercent: 0, active: false },
  { id: "band-4", label: "18:01-00:00", startTime: "18:01", endTime: "00:00", upliftPercent: 0, active: false },
];

export default function AdminPricingPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [timeUplifts, setTimeUplifts] = useState<TimeUplift[]>(defaultTimeBands);
  const [dateUplifts, setDateUplifts] = useState<DateUplift[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/pricing").then(async (res) => {
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      setSettings(data.settings || defaultSettings);
      setTimeUplifts((data.timeUplifts || defaultTimeBands) as TimeUplift[]);
      setDateUplifts((data.dateUplifts || []) as DateUplift[]);
    });
  }, []);

  function addDateRule() {
    setDateUplifts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "New rule",
        upliftPercent: 0,
        active: false,
        ruleType: "SINGLE_DATE",
        date: "",
        startDate: "",
        endDate: "",
      },
    ]);
  }

  async function save() {
    setMessage("Saving...");
    const res = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, timeUplifts, dateUplifts }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage("Failed to save pricing settings.");
      return;
    }
    setSettings(data.settings);
    setTimeUplifts(data.timeUplifts || []);
    setDateUplifts(data.dateUplifts || []);
    setMessage("Pricing settings saved.");
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Pricing Settings</h1>
      <p className="text-sm text-slate-700">Pricing estimates are customer-facing estimates. Admin can still override final quote before sending.</p>

      <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">Base pricing model</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Base fare" value={settings.baseFare} onChange={(v) => setSettings({ ...settings, baseFare: v })} />
          <NumberField label="Per mile" value={settings.perMile} onChange={(v) => setSettings({ ...settings, perMile: v })} />
          <NumberField label="Per minute" value={settings.perMinute} onChange={(v) => setSettings({ ...settings, perMinute: v })} />
          <NumberField label="Minimum fare" value={settings.minimumFare} onChange={(v) => setSettings({ ...settings, minimumFare: v })} />
          <div>
            <label className="mb-1 block text-sm">Currency</label>
            <input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2" />
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">Time uplifts</h2>
        <div className="space-y-3">
          {timeUplifts.map((rule, index) => (
            <div key={rule.id} className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-6">
              <input value={rule.label} onChange={(e) => setTimeUplifts((items) => items.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1 sm:col-span-2" />
              <input type="time" value={rule.startTime} onChange={(e) => setTimeUplifts((items) => items.map((item, i) => i === index ? { ...item, startTime: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1" />
              <input type="time" value={rule.endTime} onChange={(e) => setTimeUplifts((items) => items.map((item, i) => i === index ? { ...item, endTime: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1" />
              <input type="number" value={rule.upliftPercent} onChange={(e) => setTimeUplifts((items) => items.map((item, i) => i === index ? { ...item, upliftPercent: Number(e.target.value || 0) } : item))} className="rounded border border-slate-300 px-2 py-1" />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={rule.active} onChange={(e) => setTimeUplifts((items) => items.map((item, i) => i === index ? { ...item, active: e.target.checked } : item))} />
                Active
              </label>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Date uplift rules</h2>
          <button type="button" onClick={addDateRule} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add rule</button>
        </div>

        <div className="space-y-3">
          {dateUplifts.map((rule, index) => (
            <div key={rule.id} className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-6">
              <input value={rule.label} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1 sm:col-span-2" />
              <select value={rule.ruleType} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, ruleType: e.target.value as DateUplift["ruleType"] } : item))} className="rounded border border-slate-300 px-2 py-1">
                <option value="SINGLE_DATE">Single date</option>
                <option value="DATE_RANGE">Date range</option>
                <option value="RECURRING_ANNUAL_DATE">Recurring annual date</option>
              </select>
              <input type="number" value={rule.upliftPercent} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, upliftPercent: Number(e.target.value || 0) } : item))} className="rounded border border-slate-300 px-2 py-1" />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={rule.active} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, active: e.target.checked } : item))} />
                Active
              </label>
              <button type="button" onClick={() => setDateUplifts((items) => items.filter((_, i) => i !== index))} className="rounded border border-red-300 px-2 py-1 text-red-700">Delete</button>

              {rule.ruleType === "SINGLE_DATE" || rule.ruleType === "RECURRING_ANNUAL_DATE" ? (
                <input type="date" value={rule.date || ""} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, date: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1 sm:col-span-2" />
              ) : (
                <>
                  <input type="date" value={rule.startDate || ""} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, startDate: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1" />
                  <input type="date" value={rule.endDate || ""} onChange={(e) => setDateUplifts((items) => items.map((item, i) => i === index ? { ...item, endDate: e.target.value } : item))} className="rounded border border-slate-300 px-2 py-1" />
                </>
              )}
            </div>
          ))}
        </div>
      </article>

      <button type="button" onClick={save} className="rounded bg-amber-600 px-5 py-2 text-white">Save pricing settings</button>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm">{label}</label>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} className="w-full rounded border border-slate-300 px-3 py-2" />
    </div>
  );
}
