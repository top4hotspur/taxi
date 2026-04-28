"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DriverListItem {
  profile: { id: string; name: string; email: string; status: string };
  missingDocuments: string[];
  expiredDocuments: string[];
}

interface ReminderSummary {
  driversScanned: number;
  remindersSent: number;
  missingOnboardingRemindersSent: number;
  expiryWarningsSent: number;
  expiredDocumentAlertsSent: number;
  documentsMarkedExpired: number;
  duplicateRemindersSkipped: number;
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [summary, setSummary] = useState<ReminderSummary | null>(null);

  useEffect(() => {
    fetch("/api/admin/drivers").then(async (res) => {
      const data = (await res.json()) as { drivers?: DriverListItem[] };
      if (res.ok) setDrivers(data.drivers || []);
    });
  }, []);

  async function runReminders() {
    setRunning(true);
    setRunError("");
    setSummary(null);
    try {
      const res = await fetch("/api/admin/reminders/driver-compliance/run", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; message?: string; summary?: ReminderSummary };
      if (!res.ok || !data.success || !data.summary) {
        setRunError(data.message || "Failed to run reminders.");
        return;
      }
      setSummary(data.summary);
    } catch {
      setRunError("Failed to run reminders.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Drivers</h1>
      <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-lg font-semibold">Driver compliance reminders</h2>
        <p className="mt-1 text-slate-600">Manual trigger for Phase 3. Scheduled automation will be added later.</p>
        <button
          type="button"
          onClick={runReminders}
          disabled={running}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {running ? "Running..." : "Run driver compliance reminders"}
        </button>
        {runError && <p className="mt-2 text-red-700">{runError}</p>}
        {summary && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <p>Drivers scanned: {summary.driversScanned}</p>
            <p>Reminders sent: {summary.remindersSent}</p>
            <p>Missing onboarding reminders: {summary.missingOnboardingRemindersSent}</p>
            <p>Expiry warnings: {summary.expiryWarningsSent}</p>
            <p>Expired alerts: {summary.expiredDocumentAlertsSent}</p>
            <p>Documents marked expired: {summary.documentsMarkedExpired}</p>
            <p>Duplicates skipped: {summary.duplicateRemindersSkipped}</p>
          </div>
        )}
      </article>
      <ul className="space-y-3">
        {drivers.map((item) => (
          <li key={item.profile.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p><strong>{item.profile.name}</strong> ({item.profile.email})</p>
            <p>Status: {item.profile.status}</p>
            <p>Missing docs: {item.missingDocuments.length ? item.missingDocuments.join(", ") : "None"}</p>
            <p>Expired docs: {item.expiredDocuments.length ? item.expiredDocuments.join(", ") : "None"}</p>
            <Link href={`/admin/drivers/${item.profile.id}`} className="mt-2 inline-block underline">Review driver</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
