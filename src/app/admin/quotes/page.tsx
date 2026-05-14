"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getQuoteStatusLabel } from "@/lib/quote/constants";

type Quote = {
  id: string;
  status: string;
  paymentStatus?: "NOT_REQUIRED" | "PAYMENT_REQUIRED" | "PAID" | "PAYMENT_FAILED" | "REFUNDED";
  serviceType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  quotedPrice?: number;
  confirmedPrice?: number;
  quotedCurrency?: string;
  confirmedCurrency?: string;
  createdAt: string;
  paidAt?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  guestName?: string;
  guestEmail?: string;
  customer?: { email?: string } | null;
};

function formatUkDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", { timeZone: "Europe/London" });
}

function formatMoney(amount?: number, currency = "GBP") {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return "Pending";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function paymentLabel(status?: Quote["paymentStatus"]) {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PAYMENT_REQUIRED":
      return "Payment required";
    case "PAYMENT_FAILED":
      return "Failed";
    default:
      return "Not required";
  }
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (status && !["PAID", "PAYMENT_REQUIRED", "PAYMENT_FAILED"].includes(status)) params.set("status", status);
    if (status === "PAID") params.set("paymentStatus", "PAID");
    if (status === "PAYMENT_REQUIRED") params.set("paymentStatus", "PAYMENT_REQUIRED");
    if (status === "PAYMENT_FAILED") params.set("paymentStatus", "PAYMENT_FAILED");
    if (paymentFilter) params.set("paymentStatus", paymentFilter);
    const query = params.toString() ? `?${params.toString()}` : "";

    fetch(`/api/admin/quotes${query}`).then(async (res) => {
      const data = await res.json();
      if (!res.ok) return;
      setQuotes(data.quotes || []);
    });
  }, [status, paymentFilter]);

  const rows = useMemo(() => quotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [quotes]);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Quotes</h1>
      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-slate-300 px-3 py-2">
          <option value="">All statuses</option>
          <option value="AWAITING_CONFIRMATION">Awaiting confirmation</option>
          <option value="QUOTED">Quoted</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="PAID">Paid</option>
          <option value="PAYMENT_REQUIRED">Payment required</option>
          <option value="PAYMENT_FAILED">Payment failed</option>
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded border border-slate-300 px-3 py-2">
          <option value="">All payments</option>
          <option value="PAYMENT_REQUIRED">Payment required</option>
          <option value="PAID">Paid</option>
          <option value="PAYMENT_FAILED">Failed</option>
          <option value="NOT_REQUIRED">Not required</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Journey</th>
              <th className="px-3 py-2 font-medium">Date/Time</th>
              <th className="px-3 py-2 font-medium">Quote Status</th>
              <th className="px-3 py-2 font-medium">Payment</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((quote) => {
              const paid = quote.paymentStatus === "PAID";
              return (
                <tr key={quote.id} className={`border-b border-slate-100 align-top ${paid ? "bg-emerald-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <div>{quote.guestName || "Account customer"}</div>
                    <div className="text-xs text-slate-500">{quote.guestEmail || quote.customer?.email || "N/A"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{quote.pickupLocation} → {quote.dropoffLocation}</div>
                    <div className="text-xs text-slate-500">{quote.serviceType}</div>
                  </td>
                  <td className="px-3 py-2">{formatUkDateTime(`${quote.pickupDate}T${quote.pickupTime}`)}</td>
                  <td className="px-3 py-2">{paid ? "Quoted / Paid" : getQuoteStatusLabel(quote.status)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${paid ? "bg-emerald-100 text-emerald-800" : quote.paymentStatus === "PAYMENT_REQUIRED" ? "bg-amber-100 text-amber-800" : quote.paymentStatus === "PAYMENT_FAILED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                      {paymentLabel(quote.paymentStatus)}
                    </span>
                    {paid ? <div className="mt-1 text-xs text-emerald-800">Paid {formatMoney(quote.paymentAmount, quote.paymentCurrency || "GBP")}</div> : null}
                  </td>
                  <td className="px-3 py-2">{formatMoney(quote.confirmedPrice ?? quote.quotedPrice, quote.confirmedCurrency || quote.quotedCurrency || "GBP")}</td>
                  <td className="px-3 py-2">{formatUkDateTime(quote.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/quotes/${quote.id}`} className="underline">View / Edit</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-slate-500">No quotes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
