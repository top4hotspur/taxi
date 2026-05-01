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
  diagnostics?: { tableConfigured?: boolean; tableNamePresent?: boolean };
};

type AnalyticsErrorPayload = {
  ok: false;
  errorCode?: string;
  message?: string;
  diagnostics?: { tableConfigured?: boolean; tableNamePresent?: boolean };
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
  const [status, setStatus] = useState<"loading" | "loaded" | "empty" | "error">("loading");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<{ status: number; message: string; errorCode?: string } | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadAnalytics() {
      setStatus("loading");
      try {
        const res = await fetch("/api/admin/analytics", { cache: "no-store", signal: controller.signal });
        const text = await res.text();
        let parsed: AnalyticsPayload | AnalyticsErrorPayload | null = null;
        if (text) {
          try {
            parsed = JSON.parse(text) as AnalyticsPayload | AnalyticsErrorPayload;
          } catch {
            parsed = null;
          }
        }

        if (!active) return;

        if (!res.ok || !parsed || !("ok" in parsed) || !parsed.ok) {
          const p = parsed as AnalyticsErrorPayload | null;
          setError({
            status: res.status,
            message: p?.message || "Unable to load analytics.",
            errorCode: p?.errorCode,
          });
          setStatus("error");
          return;
        }

        const okPayload = parsed as AnalyticsPayload;
        const hasEvents =
          okPayload.totals.pageViews.last30Days > 0 ||
          okPayload.totals.quoteSubmissions.last30Days > 0 ||
          okPayload.totals.customerRegistrations.last30Days > 0 ||
          okPayload.totals.driverRegistrations.last30Days > 0;

        setData(okPayload);
        setStatus(hasEvents ? "loaded" : "empty");
      } catch {
        if (!active) return;
        setError({ status: 0, message: "Unable to load analytics." });
        setStatus("error");
      }
    }

    loadAnalytics();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (status === "loading") return <p>Loading analytics...</p>;
  if (status === "error" || !data) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Admin Analytics</h1>
        <article className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-900">Analytics failed to load</p>
          <p className="text-sm text-red-800">HTTP status: {error?.status ?? 0}</p>
          <p className="text-sm text-red-800">Message: {error?.message || "Unable to load analytics."}</p>
          {error?.errorCode && <p className="text-sm text-red-800">Code: {error.errorCode}</p>}
        </article>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Analytics</h1>
      {status === "empty" && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No analytics events recorded yet.
        </article>
      )}

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
