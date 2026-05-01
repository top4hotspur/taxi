"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

export default function QuoteConfirmationTracker() {
  useEffect(() => {
    trackAnalyticsEvent("QUOTE_CONFIRMATION_VIEWED", "/quote/confirmation");
  }, []);
  return null;
}
