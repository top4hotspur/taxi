"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    Square?: {
      payments: (applicationId: string, locationId: string) => Promise<{
        card: () => Promise<{ attach: (selector: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }> }>;
      }>;
    };
  }
}

type Props = {
  quoteId: string;
  amount: number;
  currency: string;
  onPaid: () => void;
};

export default function SquarePayQuoteForm({ quoteId, amount, currency, onPaid }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }> } | null>(null);

  const applicationId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID || "";
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || "";
  const isSandbox = useMemo(() => applicationId.toLowerCase().startsWith("sandbox-"), [applicationId]);
  const scriptSrc = isSandbox ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!applicationId || !locationId) {
        setError("Payment is currently unavailable. Please contact support.");
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(`script[data-square-sdk=\"${scriptSrc}\"]`);
      if (!existing) {
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        script.dataset.squareSdk = scriptSrc;
        document.body.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Square SDK failed to load"));
        });
      }

      if (!window.Square || cancelled) {
        if (!cancelled) setError("Payment form is unavailable right now. Please refresh and try again.");
        return;
      }

      try {
        const payments = await window.Square.payments(applicationId, locationId);
        const card = await payments.card();
        await card.attach("#square-card-container");
        cardRef.current = card;
        if (!cancelled) setCardReady(true);
      } catch {
        if (!cancelled) setError("Unable to initialize card form. Please try again.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [applicationId, locationId, scriptSrc]);

  async function handlePayNow() {
    if (!cardRef.current) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const tokenized = await cardRef.current.tokenize();
      if (tokenized.status !== "OK" || !tokenized.token) {
        setError(tokenized.errors?.[0]?.message || "Card details could not be processed.");
        return;
      }

      const response = await fetch("/api/payments/square/pay-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, sourceId: tokenized.token }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || "Payment could not be completed.");
        return;
      }

      setSuccess("Payment successful. Thank you.");
      onPaid();
    } catch {
      setError("Payment could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-lg font-semibold">Pay {currency} {amount.toFixed(2)}</p>
      <div id="square-card-container" className="min-h-24 rounded-lg border border-slate-300 p-3" />
      <p className="text-xs text-slate-600">
        By paying, you agree to our <a className="underline" href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> and <a className="underline" href="/policies" target="_blank" rel="noreferrer">Policies</a>.
      </p>
      <button
        type="button"
        onClick={handlePayNow}
        disabled={loading || !cardReady}
        className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
    </div>
  );
}
