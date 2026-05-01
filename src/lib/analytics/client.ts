"use client";

const ANON_KEY = "ni_taxi_anon_visitor_id";
const SESSION_KEY = "ni_taxi_session_id";
const LANDING_KEY = "ni_taxi_landing_page";

export type AnalyticsEventType =
  | "PAGE_VIEW"
  | "QUOTE_STARTED"
  | "QUOTE_ESTIMATE_CALCULATED"
  | "QUOTE_SUBMITTED"
  | "CUSTOMER_REGISTER_STARTED"
  | "CUSTOMER_REGISTERED"
  | "DRIVER_REGISTER_STARTED"
  | "DRIVER_REGISTERED";

function getOrCreateLocalStorageValue(key: string) {
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

function getOrCreateSessionValue(key: string) {
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

function getLandingPage() {
  const existing = window.sessionStorage.getItem(LANDING_KEY);
  if (existing) return existing;
  const landing = window.location.pathname;
  window.sessionStorage.setItem(LANDING_KEY, landing);
  return landing;
}

export async function trackAnalyticsEvent(eventType: AnalyticsEventType, pathOverride?: string) {
  try {
    const anonymousVisitorId = getOrCreateLocalStorageValue(ANON_KEY);
    const sessionId = getOrCreateSessionValue(SESSION_KEY);
    const landingPage = getLandingPage();
    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        path: pathOverride || window.location.pathname,
        referrer: document.referrer || "",
        landingPage,
        sessionId,
        anonymousVisitorId,
      }),
      keepalive: true,
    });
  } catch {
    // Never block user journeys on analytics failures.
  }
}
