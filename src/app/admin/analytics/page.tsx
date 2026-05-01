"use client";

import { useEffect, useState } from "react";

type AnalyticsPayload = {
  ok: boolean;
  totals: {
    visitors: { today: number; last7Days: number; last30Days: number };
    pageViews: { today: number; last7Days: number; last30Days: number };
    quoteSubmissions: { today: number; last7Days: number; last30Days: number };
    estimateCalculations: { today: number; last7Days: number; last30Days: number };
    customerRegistrations: { today: number; last7Days: number; last30Days: number };
    driverRegistrations: { today: number; last7Days: number; last30Days: number };
    conversion: { visitorsToQuoteSubmission: number; quoteStartToSubmission: number };
  };
  topPages: Array<{ path: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
};

function MetricCard({ label, today, last7Days, last30Days }: { label: string; today: number; last7Days: number; last30Days: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-sm">Today: <strong>{today}</strong></p>
      <p className="text-sm">7 days: <strong>{last7Days}</strong></p>
      <p className="text-sm">30 days: <strong>{last30Days}</strong></p>
    </article>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store" }).then(async (res) => {
      const json = (await res.json()) as AnalyticsPayload & { message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message || "Unable to load analytics.");
        return;
      }
      setData(json);
    });
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p>Loading analytics...</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Visitors" {...data.totals.visitors} />
        <MetricCard label="Page views" {...data.totals.pageViews} />
        <MetricCard label="Quote submissions" {...data.totals.quoteSubmissions} />
        <MetricCard label="Estimate calculations" {...data.totals.estimateCalculations} />
        <MetricCard label="Customer registrations" {...data.totals.customerRegistrations} />
        <MetricCard label="Driver registrations" {...data.totals.driverRegistrations} />
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Conversions (30 days)</h2>
        <p className="mt-2 text-sm">Visitors {"->"} Quote submissions: <strong>{data.totals.conversion.visitorsToQuoteSubmission}%</strong></p>
        <p className="text-sm">Quote starts {"->"} Quote submissions: <strong>{data.totals.conversion.quoteStartToSubmission}%</strong></p>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Top pages</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.topPages.map((row) => (
              <li key={row.path} className="flex items-center justify-between">
                <span>{row.path}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Top referrers</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.topReferrers.map((row) => (
              <li key={row.referrer} className="flex items-center justify-between gap-2">
                <span className="truncate">{row.referrer}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
