"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { KNOWN_TAXI_LOCATIONS } from "@/lib/quote/known-locations";

const serviceTypes = ["Airport Transfer", "Golf Transfer", "Tourist Day Trip", "Event Transport", "Other"];
const PLACE_CLEAR_EVENT = "ni-taxi-place-autocomplete-clear";
const pricingRelevantFields = new Set([
  "pickupLocation", "dropoffLocation", "pickupDate", "pickupTime", "passengers", "returnJourney",
  "returnPickupLocation", "returnDropoffLocation", "returnDate", "returnTime", "handLuggageCount", "suitcaseCount", "oversizeItemCount", "serviceType",
]);
const QUOTE_DRAFT_KEY = "ni_taxi_quote_draft_v1";

function loadDraftFromSessionStorage() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  const raw = window.sessionStorage.getItem(QUOTE_DRAFT_KEY);
  if (!raw) return {} as Record<string, string>;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    window.sessionStorage.removeItem(QUOTE_DRAFT_KEY);
    return {} as Record<string, string>;
  }
}

function saveDraftToSessionStorage(draft: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(draft));
}

function clearDraftFromSessionStorage() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(QUOTE_DRAFT_KEY);
}

type EstimateResponse = {
  ok: boolean;
  estimatedFare?: number | null;
  finalEstimatedFare?: number | null;
  outwardEstimatedFare?: number | null;
  returnEstimatedFare?: number | null;
  returnDiscountPercent?: number | null;
  returnDiscountAmount?: number | null;
  currency?: string;
  distanceMiles?: number | null;
  durationMinutes?: number | null;
  fareBreakdown?: Record<string, unknown> | null;
  pricingSource?: string;
  requiresManualReview?: boolean;
  routeEstimateFailed?: boolean;
  routeEstimateFailureReason?: string | null;
  customerMessage?: string;
  manualGroupQuote?: boolean;
  diagnostics?: Record<string, unknown> | null;
};

function isAirportLocation(value: string) {
  return value.toLowerCase().includes("airport");
}

function trimmed(value: string | undefined) {
  return String(value || "").trim();
}

function phoneLooksUsable(value: string | undefined) {
  const compact = trimmed(value).replace(/[^\d+]/g, "");
  return compact.length >= 7;
}

function formatEstimateMoney(value: number | null | undefined, currency = "GBP") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
  } catch {
    return `£${value.toFixed(2)}`;
  }
}

export default function QuoteForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [initialDraft] = useState<Record<string, string>>(() => loadDraftFromSessionStorage());
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimateStale, setEstimateStale] = useState(false);
  const [returnJourneyNeeded, setReturnJourneyNeeded] = useState(String(initialDraft.returnJourney || "No") === "Yes");
  const [leadPassengerSameAsBooker, setLeadPassengerSameAsBooker] = useState(String(initialDraft.leadPassengerSameAsBooker || "Yes") === "Yes");
  const [formState, setFormState] = useState<Record<string, string>>(initialDraft);
  const [draftRestored, setDraftRestored] = useState(Object.keys(initialDraft).length > 0);
  const [customerContext, setCustomerContext] = useState({ loggedInCustomer: false, email: "", name: "", phone: "" });
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(String(initialDraft.termsAccepted || "").toLowerCase() === "true");
  const [quickSelectSourceByField, setQuickSelectSourceByField] = useState<Record<string, boolean>>({});
  const estimateSequenceRef = useRef(0);

  useEffect(() => {
    trackAnalyticsEvent("QUOTE_STARTED", "/quote");
    let active = true;
    fetch("/api/account/profile", { cache: "no-store" }).then(async (response) => {
      if (!response.ok || !active) return;
      const data = (await response.json()) as { ok?: boolean; user?: { email?: string; role?: string }; profile?: { name?: string; phone?: string } | null };
      if (!data.ok || data.user?.role !== "customer" || !active) return;
      setCustomerContext({
        loggedInCustomer: true,
        email: String(data.user?.email || "").trim(),
        name: String(data.profile?.name || "").trim(),
        phone: String(data.profile?.phone || "").trim(),
      });
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const canCalculate = (() => {
    const hasBase = Boolean((formState.pickupLocation || "").trim() && (formState.dropoffLocation || "").trim() && (formState.pickupDate || "").trim() && (formState.pickupTime || "").trim() && (formState.passengers || "").trim());
    if (!hasBase) return false;
    if (!returnJourneyNeeded) return true;
    return Boolean((formState.returnPickupLocation || "").trim() && (formState.returnDropoffLocation || "").trim() && (formState.returnDate || "").trim() && (formState.returnTime || "").trim());
  })();

  const effectiveBookerName = customerContext.loggedInCustomer ? customerContext.name || formState.name : formState.name;
  const effectiveBookerEmail = customerContext.loggedInCustomer ? customerContext.email || formState.email : formState.email;
  const effectiveBookerPhone = customerContext.loggedInCustomer ? customerContext.phone || formState.phone : formState.phone;

  function markPotentiallyStale(fieldName: string) {
    if (!estimate || !pricingRelevantFields.has(fieldName)) return;
    if (!estimateStale) {
      setEstimateStale(true);
      trackAnalyticsEvent("QUOTE_ESTIMATE_STALE", "/quote");
    }
  }

  function resetReturnToReverse() {
    const outwardPickup = formState.pickupLocation || "";
    const outwardDropoff = formState.dropoffLocation || "";
    setFormState((current) => ({
      ...current,
      returnPickupLocation: outwardDropoff,
      returnDropoffLocation: outwardPickup,
      returnPickupPlaceId: "",
      returnPickupAddress: "",
      returnPickupLat: "",
      returnPickupLng: "",
      returnDropoffPlaceId: "",
      returnDropoffAddress: "",
      returnDropoffLat: "",
      returnDropoffLng: "",
    }));
    setQuickSelectSourceByField((current) => ({
      ...current,
      returnPickupLocation: false,
      returnDropoffLocation: false,
    }));
    window.dispatchEvent(new CustomEvent(PLACE_CLEAR_EVENT, { detail: { fieldName: "returnPickupLocation" } }));
    window.dispatchEvent(new CustomEvent(PLACE_CLEAR_EVENT, { detail: { fieldName: "returnDropoffLocation" } }));
    markPotentiallyStale("returnPickupLocation");
    markPotentiallyStale("returnDropoffLocation");
  }

  function setFieldValue(name: string, value: string) {
    if (!formRef.current) return;
    const input = formRef.current.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function applyQuickLocation(params: {
    locationField: string;
    placeIdField: string;
    addressField: string;
    latField: string;
    lngField: string;
    value: string;
  }) {
    window.dispatchEvent(new CustomEvent(PLACE_CLEAR_EVENT, { detail: { fieldName: params.locationField } }));
    setFormState((current) => ({
      ...current,
      [params.locationField]: params.value,
      [params.placeIdField]: "",
      [params.addressField]: params.value,
      [params.latField]: "",
      [params.lngField]: "",
    }));
    setQuickSelectSourceByField((current) => ({ ...current, [params.locationField]: true }));
    markPotentiallyStale(params.locationField);
  }

  function applyLocationTextChange(fieldName: string, value: string) {
    setFormState((current) => ({ ...current, [fieldName]: value }));
    setQuickSelectSourceByField((current) => ({ ...current, [fieldName]: false }));
    markPotentiallyStale(fieldName);
  }

  function applyStructuredLocationChange(
    locationFieldName: string,
    structured: { placeId: string; address: string; lat: string; lng: string }
  ) {
    const prefix =
      locationFieldName === "pickupLocation"
        ? "pickup"
        : locationFieldName === "dropoffLocation"
          ? "dropoff"
          : locationFieldName === "returnPickupLocation"
            ? "returnPickup"
            : "returnDropoff";
    setFormState((current) => ({
      ...current,
      [`${prefix}PlaceId`]: structured.placeId,
      [`${prefix}Address`]: structured.address,
      [`${prefix}Lat`]: structured.lat,
      [`${prefix}Lng`]: structured.lng,
    }));
    markPotentiallyStale(`${prefix}PlaceId`);
    markPotentiallyStale(`${prefix}Lat`);
    markPotentiallyStale(`${prefix}Lng`);
  }

  const buildEstimatePayload = useCallback(() => {
    return {
      pickupLocation: String(formState.pickupLocation || "").trim(),
      pickupPlaceId: String(formState.pickupPlaceId || "").trim(),
      pickupLat: String(formState.pickupLat || "").trim(),
      pickupLng: String(formState.pickupLng || "").trim(),
      dropoffLocation: String(formState.dropoffLocation || "").trim(),
      dropoffPlaceId: String(formState.dropoffPlaceId || "").trim(),
      dropoffLat: String(formState.dropoffLat || "").trim(),
      dropoffLng: String(formState.dropoffLng || "").trim(),
      returnJourney: returnJourneyNeeded ? "Yes" : "No",
      returnPickupLocation: String(formState.returnPickupLocation || "").trim(),
      returnPickupPlaceId: String(formState.returnPickupPlaceId || "").trim(),
      returnPickupLat: String(formState.returnPickupLat || "").trim(),
      returnPickupLng: String(formState.returnPickupLng || "").trim(),
      returnDropoffLocation: String(formState.returnDropoffLocation || "").trim(),
      returnDropoffPlaceId: String(formState.returnDropoffPlaceId || "").trim(),
      returnDropoffLat: String(formState.returnDropoffLat || "").trim(),
      returnDropoffLng: String(formState.returnDropoffLng || "").trim(),
      returnDate: String(formState.returnDate || "").trim(),
      returnTime: String(formState.returnTime || "").trim(),
      serviceType: String(formState.serviceType || "").trim(),
      pickupDate: String(formState.pickupDate || "").trim(),
      pickupTime: String(formState.pickupTime || "").trim(),
      passengers: String(formState.passengers || "").trim(),
      oversizeItemCount: String(formState.oversizeItemCount || "0").trim(),
      itineraryMessage: String(formState.itineraryMessage || "").trim(),
      quickSelectSourceByField,
    };
  }, [formState, quickSelectSourceByField, returnJourneyNeeded]);

  function buildDraftFromForm(form: HTMLFormElement) {
    const fd = new FormData(form);
    return {
      ...Object.fromEntries(Array.from(fd.entries()).map(([key, value]) => [key, String(value)])),
      returnJourney: returnJourneyNeeded ? "Yes" : "No",
      leadPassengerSameAsBooker: leadPassengerSameAsBooker ? "Yes" : "No",
      termsAccepted: termsAccepted ? "true" : "",
    };
  }

  function validateBeforeSubmit() {
    if (!trimmed(effectiveBookerName)) return "Please enter your name.";
    if (!trimmed(effectiveBookerEmail)) return "Please enter your email address.";
    if (!phoneLooksUsable(effectiveBookerPhone)) return "Please enter your phone number so we can contact you about your booking.";
    if (!canCalculate) {
      return returnJourneyNeeded
        ? "Please complete your outward and return journey details before submitting."
        : "Please complete your pickup, drop-off, date, time and passenger details before submitting.";
    }
    if (!leadPassengerSameAsBooker && !trimmed(formState.leadPassengerName)) return "Please enter the lead passenger name.";
    if (!leadPassengerSameAsBooker && !phoneLooksUsable(formState.leadPassengerPhone)) return "Please enter the lead passenger phone number.";
    if (!termsAccepted) return "Please accept the Terms & Conditions and Policies before submitting.";
    return "";
  }

  function renderQuickSelectButtons({
    fieldLabel,
    locationField,
    placeIdField,
    addressField,
    latField,
    lngField,
  }: {
    fieldLabel: string;
    locationField: string;
    placeIdField: string;
    addressField: string;
    latField: string;
    lngField: string;
  }) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">Quick select:</p>
        <div className="flex flex-wrap gap-1.5">
          {KNOWN_TAXI_LOCATIONS.map((location) => (
            <button
              key={`${locationField}-${location.label}`}
              type="button"
              aria-label={`Set ${fieldLabel} to ${location.label}`}
              onClick={() =>
                applyQuickLocation({
                  locationField,
                  placeIdField,
                  addressField,
                  latField,
                  lngField,
                  value: location.address,
                })
              }
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {location.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const calculateEstimate = useCallback(async (source: "auto" | "manual" = "manual") => {
    const payload = buildEstimatePayload();
    const requestSequence = estimateSequenceRef.current + 1;
    estimateSequenceRef.current = requestSequence;
    setEstimating(true);
    setEstimateError("");
    if (source === "auto") trackAnalyticsEvent("QUOTE_AUTO_ESTIMATE_STARTED", "/quote");
    try {
      const response = await fetch("/api/pricing/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as EstimateResponse;
      if (!response.ok) throw new Error("Unable to calculate estimate right now.");
      if (requestSequence < estimateSequenceRef.current) {
        return;
      }
      setEstimate(result);
      setEstimateStale(false);
      trackAnalyticsEvent("QUOTE_ESTIMATE_RECALCULATED", "/quote");
      trackAnalyticsEvent("QUOTE_ESTIMATE_CALCULATED", "/quote");
      if (result.manualGroupQuote) {
        setEstimateError(result.customerMessage || "We can't estimate prices online for groups larger than 8 passengers. Please submit your request and we'll be in touch shortly with a tailored quote.");
        if (source === "auto") trackAnalyticsEvent("QUOTE_AUTO_ESTIMATE_FAILED", "/quote");
      } else if (result.routeEstimateFailed) {
        setEstimateError(result.customerMessage || "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.");
        if (source === "auto") trackAnalyticsEvent("QUOTE_AUTO_ESTIMATE_FAILED", "/quote");
      } else if (source === "auto") {
        trackAnalyticsEvent("QUOTE_AUTO_ESTIMATE_SUCCEEDED", "/quote");
      }
    } catch {
      if (requestSequence < estimateSequenceRef.current) {
        return;
      }
      setEstimateError("We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.");
      setEstimate(null);
      if (source === "auto") trackAnalyticsEvent("QUOTE_AUTO_ESTIMATE_FAILED", "/quote");
    } finally {
      if (requestSequence >= estimateSequenceRef.current) {
        setEstimating(false);
      }
    }
  }, [buildEstimatePayload]);

  useEffect(() => {
    if (!canCalculate) return;
    const timer = window.setTimeout(() => {
      void calculateEstimate("auto");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    canCalculate,
    returnJourneyNeeded,
    formState.pickupLocation,
    formState.pickupPlaceId,
    formState.pickupLat,
    formState.pickupLng,
    formState.dropoffLocation,
    formState.dropoffPlaceId,
    formState.dropoffLat,
    formState.dropoffLng,
    formState.pickupDate,
    formState.pickupTime,
    formState.returnPickupLocation,
    formState.returnPickupPlaceId,
    formState.returnPickupLat,
    formState.returnPickupLng,
    formState.returnDropoffLocation,
    formState.returnDropoffPlaceId,
    formState.returnDropoffLat,
    formState.returnDropoffLng,
    formState.returnDate,
    formState.returnTime,
    formState.passengers,
    formState.handLuggageCount,
    formState.suitcaseCount,
    formState.oversizeItemCount,
    formState.serviceType,
    formState.accountType,
    formState.itineraryMessage,
    calculateEstimate,
  ]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage("");
    setMessage("");
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setValidationMessage(validationError);
      trackAnalyticsEvent("QUOTE_VALIDATION_FAILED", "/quote");
      return;
    }
    if (!customerContext.loggedInCustomer) {
      saveDraftToSessionStorage(buildDraftFromForm(event.currentTarget));
      setDraftRestored(false);
      setShowLoginRequired(true);
      setStatus("idle");
      trackAnalyticsEvent("QUOTE_LOGIN_REQUIRED_SHOWN", "/quote");
      return;
    }

    setStatus("loading");
    setMessage("");
    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: customerContext.loggedInCustomer ? customerContext.name || String(fd.get("name") || "") : String(fd.get("name") || ""),
      email: customerContext.loggedInCustomer ? customerContext.email || String(fd.get("email") || "") : String(fd.get("email") || ""),
      phone: customerContext.loggedInCustomer ? customerContext.phone || String(fd.get("phone") || "") : String(fd.get("phone") || ""),
      passengerName: String(fd.get("passengerName") || ""),
      passengerPhone: String(fd.get("passengerPhone") || ""),
      leadPassengerSameAsBooker,
      leadPassengerName: leadPassengerSameAsBooker ? "" : String(fd.get("leadPassengerName") || ""),
      leadPassengerEmail: leadPassengerSameAsBooker ? "" : String(fd.get("leadPassengerEmail") || ""),
      leadPassengerPhone: leadPassengerSameAsBooker ? "" : String(fd.get("leadPassengerPhone") || ""),
      accountType: String(fd.get("accountType") || "PERSONAL"),
      serviceType: String(fd.get("serviceType") || ""),
      pickupLocation: String(fd.get("pickupLocation") || ""),
      pickupPlaceId: String(fd.get("pickupPlaceId") || ""),
      pickupAddress: String(fd.get("pickupAddress") || ""),
      pickupLat: String(fd.get("pickupLat") || ""),
      pickupLng: String(fd.get("pickupLng") || ""),
      dropoffLocation: String(fd.get("dropoffLocation") || ""),
      dropoffPlaceId: String(fd.get("dropoffPlaceId") || ""),
      dropoffAddress: String(fd.get("dropoffAddress") || ""),
      dropoffLat: String(fd.get("dropoffLat") || ""),
      dropoffLng: String(fd.get("dropoffLng") || ""),
      pickupDate: String(fd.get("pickupDate") || ""),
      pickupTime: String(fd.get("pickupTime") || ""),
      passengers: String(fd.get("passengers") || ""),
      handLuggageCount: String(fd.get("handLuggageCount") || "0"),
      suitcaseCount: String(fd.get("suitcaseCount") || "0"),
      oversizeItemCount: String(fd.get("oversizeItemCount") || "0"),
      returnJourney: returnJourneyNeeded ? "Yes" : "No",
      returnJourneyNeeded,
      returnPickup: String(fd.get("returnPickupLocation") || ""),
      returnPickupPlaceId: String(fd.get("returnPickupPlaceId") || ""),
      returnPickupAddress: String(fd.get("returnPickupAddress") || ""),
      returnPickupLat: String(fd.get("returnPickupLat") || ""),
      returnPickupLng: String(fd.get("returnPickupLng") || ""),
      returnDropoff: String(fd.get("returnDropoffLocation") || ""),
      returnDropoffPlaceId: String(fd.get("returnDropoffPlaceId") || ""),
      returnDropoffAddress: String(fd.get("returnDropoffAddress") || ""),
      returnDropoffLat: String(fd.get("returnDropoffLat") || ""),
      returnDropoffLng: String(fd.get("returnDropoffLng") || ""),
      returnDate: String(fd.get("returnDate") || ""),
      returnTime: String(fd.get("returnTime") || ""),
      itineraryMessage: String(fd.get("itineraryMessage") || ""),
      estimatedFare: estimate?.estimatedFare,
      finalEstimatedFare: estimate?.finalEstimatedFare,
      outwardEstimatedFare: estimate?.outwardEstimatedFare,
      returnEstimatedFare: estimate?.returnEstimatedFare,
      returnDiscountPercent: estimate?.returnDiscountPercent,
      returnDiscountAmount: estimate?.returnDiscountAmount,
      estimatedCurrency: estimate?.currency,
      estimatedDistanceMiles: estimate?.distanceMiles,
      estimatedDurationMinutes: estimate?.durationMinutes,
      estimatedFareBreakdown: estimate?.fareBreakdown ? JSON.stringify(estimate.fareBreakdown) : "",
      pricingSource: estimate?.pricingSource || (estimateError ? "FALLBACK_MANUAL_REVIEW" : ""),
      requiresManualReview: Boolean(estimate?.requiresManualReview || estimateStale || estimateError),
      pricingCalculatedAt: estimate ? new Date().toISOString() : "",
      routeEstimateFailed: Boolean(estimate?.routeEstimateFailed || estimateStale || estimateError),
      routeEstimateFailureReason: String(estimateStale ? "Journey details changed after estimate." : estimate?.routeEstimateFailureReason || estimateError || ""),
      outwardFlightNumber: outwardAirportPickup ? String(fd.get("outwardFlightNumber") || "") : "",
      returnFlightNumber: returnAirportPickup ? String(fd.get("returnFlightNumber") || "") : "",
      termsAccepted: String(fd.get("termsAccepted") || "").toLowerCase() === "true",
      policyVersion: "v1-2026-05",
    };
    try {
      const response = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = await response.text();
      const result = text ? (JSON.parse(text) as { ok?: boolean; message?: string; error?: string; quoteId?: string }) : {};
      if (!response.ok) throw new Error(result.error || result.message || "Unable to submit quote request.");
      trackAnalyticsEvent("QUOTE_SUBMITTED", "/quote");
      trackAnalyticsEvent("QUOTE_SUBMITTED_AUTHENTICATED", "/quote");
      clearDraftFromSessionStorage();
      router.push(result.quoteId ? `/quote/confirmation?quoteId=${encodeURIComponent(result.quoteId)}` : "/quote/confirmation");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit quote request.");
    }
  }

  const showNameField = !customerContext.loggedInCustomer || !customerContext.name;
  const showEmailField = !customerContext.loggedInCustomer || !customerContext.email;
  const showPhoneField = !customerContext.loggedInCustomer || !customerContext.phone;
  const outwardAirportPickup = isAirportLocation(formState.pickupLocation || "");
  const returnAirportPickup = returnJourneyNeeded && isAirportLocation(formState.returnPickupLocation || "");

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChangeCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
        if (target.name === "returnJourney") setReturnJourneyNeeded(target.value === "Yes");
        if (target.name === "leadPassengerSameAsBooker") setLeadPassengerSameAsBooker(target.value === "Yes");
        if (target.name === "termsAccepted" && target instanceof HTMLInputElement) setTermsAccepted(target.checked);
        if (target.name) {
          markPotentiallyStale(target.name);
          setFormState((current) => ({ ...current, [target.name]: target.value }));
          if (target.name === "pickupLocation" && !isAirportLocation(target.value)) {
            setFieldValue("outwardFlightNumber", "");
            setFormState((current) => ({ ...current, outwardFlightNumber: "" }));
          }
          if (target.name === "returnPickupLocation" && !isAirportLocation(target.value)) {
            setFieldValue("returnFlightNumber", "");
            setFormState((current) => ({ ...current, returnFlightNumber: "" }));
          }
        }
      }}
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      {draftRestored ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Your quote details have been restored. Please review and submit your quote.
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Booker details</h2>
        {customerContext.loggedInCustomer && !showNameField && !showEmailField && !showPhoneField ? (
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold">Booking as {customerContext.name}</p>
            <p>{customerContext.email}</p>
            <p>{customerContext.phone}</p>
          </article>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          {showNameField && <InputField label="Booker name" name="name" required defaultValue={formState.name || ""} />}
          {showEmailField && <InputField label="Booker email" name="email" type="email" required defaultValue={formState.email || ""} />}
          {showPhoneField && <InputField label="Booker phone / WhatsApp" name="phone" required defaultValue={formState.phone || ""} />}
          <InputField label="Passenger name (if different)" name="passengerName" defaultValue={formState.passengerName || ""} />
          <InputField label="Passenger phone (if different)" name="passengerPhone" defaultValue={formState.passengerPhone || ""} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Journey details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <PlaceAutocompleteInput label="Outward pickup location" required locationNameField="pickupLocation" placeIdField="pickupPlaceId" addressField="pickupAddress" latField="pickupLat" lngField="pickupLng" locationValue={formState.pickupLocation || ""} placeIdValue={formState.pickupPlaceId || ""} addressValue={formState.pickupAddress || ""} latValue={formState.pickupLat || ""} lngValue={formState.pickupLng || ""} onLocationValueChange={applyLocationTextChange} onStructuredPlaceChange={applyStructuredLocationChange} />
            {renderQuickSelectButtons({
              fieldLabel: "outward pickup",
              locationField: "pickupLocation",
              placeIdField: "pickupPlaceId",
              addressField: "pickupAddress",
              latField: "pickupLat",
              lngField: "pickupLng",
            })}
            {outwardAirportPickup ? (
              <div className="space-y-1">
                <InputField label="Flight number" name="outwardFlightNumber" placeholder="e.g. EI123, BA1416" defaultValue={formState.outwardFlightNumber || ""} />
                <p className="text-xs text-slate-500">This helps us monitor arrivals and plan pickup timing.</p>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <PlaceAutocompleteInput label="Outward drop-off location" required locationNameField="dropoffLocation" placeIdField="dropoffPlaceId" addressField="dropoffAddress" latField="dropoffLat" lngField="dropoffLng" locationValue={formState.dropoffLocation || ""} placeIdValue={formState.dropoffPlaceId || ""} addressValue={formState.dropoffAddress || ""} latValue={formState.dropoffLat || ""} lngValue={formState.dropoffLng || ""} onLocationValueChange={applyLocationTextChange} onStructuredPlaceChange={applyStructuredLocationChange} />
            {renderQuickSelectButtons({
              fieldLabel: "outward drop-off",
              locationField: "dropoffLocation",
              placeIdField: "dropoffPlaceId",
              addressField: "dropoffAddress",
              latField: "dropoffLat",
              lngField: "dropoffLng",
            })}
          </div>
          <InputField label="Outward date" name="pickupDate" type="date" required defaultValue={formState.pickupDate || ""} />
          <InputField label="Outward time" name="pickupTime" type="time" required defaultValue={formState.pickupTime || ""} />
          <SelectField label="Service type" name="serviceType" options={serviceTypes} required defaultValue={formState.serviceType || ""} />
          <SelectField label="Account type" name="accountType" options={["PERSONAL", "BUSINESS"]} required defaultValue={formState.accountType || "PERSONAL"} />
          <SelectField label="Return journey needed? (Book return now and receive 10% off the combined fare)" name="returnJourney" options={["No", "Yes"]} required defaultValue={formState.returnJourney || "No"} />
        </div>
      </section>

      {returnJourneyNeeded && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Return journey</h2>
          <p className="text-sm text-slate-600">We&apos;ll pre-fill the return route as the reverse of your outward journey. You can change it if needed.</p>
          <button type="button" onClick={resetReturnToReverse} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">Reset to reverse outward route</button>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <PlaceAutocompleteInput label="Return pickup location" required locationNameField="returnPickupLocation" placeIdField="returnPickupPlaceId" addressField="returnPickupAddress" latField="returnPickupLat" lngField="returnPickupLng" defaultValueFieldName="dropoffLocation" locationValue={formState.returnPickupLocation || ""} placeIdValue={formState.returnPickupPlaceId || ""} addressValue={formState.returnPickupAddress || ""} latValue={formState.returnPickupLat || ""} lngValue={formState.returnPickupLng || ""} onLocationValueChange={applyLocationTextChange} onStructuredPlaceChange={applyStructuredLocationChange} />
              {renderQuickSelectButtons({
                fieldLabel: "return pickup",
                locationField: "returnPickupLocation",
                placeIdField: "returnPickupPlaceId",
                addressField: "returnPickupAddress",
                latField: "returnPickupLat",
                lngField: "returnPickupLng",
              })}
              {returnAirportPickup ? <InputField label="Return flight number" name="returnFlightNumber" placeholder="e.g. EI123, BA1416" defaultValue={formState.returnFlightNumber || ""} /> : null}
            </div>
            <div className="space-y-2">
              <PlaceAutocompleteInput label="Return drop-off location" required locationNameField="returnDropoffLocation" placeIdField="returnDropoffPlaceId" addressField="returnDropoffAddress" latField="returnDropoffLat" lngField="returnDropoffLng" defaultValueFieldName="pickupLocation" locationValue={formState.returnDropoffLocation || ""} placeIdValue={formState.returnDropoffPlaceId || ""} addressValue={formState.returnDropoffAddress || ""} latValue={formState.returnDropoffLat || ""} lngValue={formState.returnDropoffLng || ""} onLocationValueChange={applyLocationTextChange} onStructuredPlaceChange={applyStructuredLocationChange} />
              {renderQuickSelectButtons({
                fieldLabel: "return drop-off",
                locationField: "returnDropoffLocation",
                placeIdField: "returnDropoffPlaceId",
                addressField: "returnDropoffAddress",
                latField: "returnDropoffLat",
                lngField: "returnDropoffLng",
              })}
            </div>
            <InputField label="Return date" name="returnDate" type="date" required defaultValue={formState.returnDate || ""} />
            <InputField label="Return time" name="returnTime" type="time" required defaultValue={formState.returnTime || ""} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Luggage / passengers</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <InputField label="Number of passengers" name="passengers" type="number" min={1} required defaultValue={formState.passengers || ""} />
          <InputField label="Hand luggage" name="handLuggageCount" type="number" min={0} defaultValue={formState.handLuggageCount || "0"} />
          <InputField label="Suitcases" name="suitcaseCount" type="number" min={0} defaultValue={formState.suitcaseCount || "0"} />
          <div>
            <InputField label="Oversize items" name="oversizeItemCount" type="number" min={0} defaultValue={formState.oversizeItemCount || "0"} />
            <p className="mt-1 text-xs text-slate-500">For example golf clubs, skis, large boxes or mobility equipment.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Is the lead passenger the same person as the booker?" name="leadPassengerSameAsBooker" options={["Yes", "No"]} required defaultValue={formState.leadPassengerSameAsBooker || "Yes"} />
          {!leadPassengerSameAsBooker ? (
            <>
              <InputField label="Lead passenger name" name="leadPassengerName" required defaultValue={formState.leadPassengerName || ""} />
              <InputField label="Lead passenger email address" name="leadPassengerEmail" type="email" defaultValue={formState.leadPassengerEmail || ""} />
              <InputField label="Lead passenger phone number" name="leadPassengerPhone" required defaultValue={formState.leadPassengerPhone || ""} />
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Special requests</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor="itineraryMessage">Message / Itinerary / Special Requests</label>
          <textarea id="itineraryMessage" name="itineraryMessage" rows={5} defaultValue={formState.itineraryMessage || ""} placeholder="Add flight details, pickup instructions, child seats, accessibility needs, stop-offs, or anything else we should know." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Estimate</h2>
        {!canCalculate ? <p className="text-sm text-slate-600">Enter your journey details and we&apos;ll estimate the price automatically.</p> : null}
        {estimating ? <p className="text-sm font-medium text-slate-700">Calculating estimate...</p> : null}
        {estimateStale && <p className="text-sm font-medium text-amber-700">Journey details changed. Please recalculate before submitting.</p>}
        {canCalculate && estimateError ? (
          <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Manual quote required</p>
            <p>{estimateError}</p>
          </article>
        ) : null}
        {canCalculate && estimate?.ok && !estimate.manualGroupQuote && !estimate.routeEstimateFailed && (estimate.finalEstimatedFare ?? estimate.estimatedFare) !== null && !estimateError ? (
          <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900">
            {returnJourneyNeeded ? (
              <>
                <p className="text-lg font-semibold">Estimated return fare: {formatEstimateMoney(estimate.finalEstimatedFare, estimate.currency)}</p>
                <p>Outward journey: {formatEstimateMoney(estimate.outwardEstimatedFare, estimate.currency)}</p>
                <p>Return journey: {formatEstimateMoney(estimate.returnEstimatedFare, estimate.currency)}</p>
                <p>Return booking discount 10%: -{formatEstimateMoney(estimate.returnDiscountAmount, estimate.currency)}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">Estimated fare: {formatEstimateMoney(estimate.finalEstimatedFare ?? estimate.estimatedFare, estimate.currency)}</p>
                {estimate.distanceMiles !== null && estimate.distanceMiles !== undefined ? <p>Distance: {estimate.distanceMiles} miles</p> : null}
                {estimate.durationMinutes !== null && estimate.durationMinutes !== undefined ? <p>Journey time: {estimate.durationMinutes} minutes</p> : null}
                <p>{estimate.fareBreakdown?.["airportSurchargeApplied"] ? "Airport surcharge included." : ""}</p>
                <p>{estimate.fareBreakdown?.["passengerUpliftPercent"] ? "Passenger uplift included." : ""}</p>
              </>
            )}
            <p className="mt-2 text-slate-700">Subject to driver availability and final confirmation.</p>
          </article>
        ) : null}
        {canCalculate ? (
          <button type="button" onClick={() => calculateEstimate("manual")} disabled={estimating} className="text-xs font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-60">
            Recalculate estimate
          </button>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" name="termsAccepted" value="true" required defaultChecked={termsAccepted} className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            I have read and agree to the <Link href="/terms" className="font-semibold underline" target="_blank">Terms &amp; Conditions</Link> and <Link href="/policies" className="font-semibold underline" target="_blank">Policies</Link>.
          </span>
        </label>
      </section>

      <button type="submit" disabled={status === "loading"} className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
        {status === "loading" ? "Submitting..." : customerContext.loggedInCustomer ? "Submit Quote Request" : "Continue to receive quote"}
      </button>
      {validationMessage ? <p className="text-sm text-red-700">{validationMessage}</p> : null}
      {customerContext.loggedInCustomer ? (
        <p className="text-sm text-slate-600">
          We&apos;ll email quote updates to your account email address. Please check your junk/spam folder if an email doesn&apos;t arrive. We may also send key updates by WhatsApp where available.
        </p>
      ) : null}
      {message && <p className="text-sm text-red-700">{message}</p>}
      {showLoginRequired && !customerContext.loggedInCustomer ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
          <h2 className="text-lg font-semibold text-slate-900">Create an account to receive your quote</h2>
          <p>We&apos;ll save your quote, confirmed price, payment link and driver details in your account.</p>
          <p>Already have an account? Sign in to continue.</p>
          <p className="text-xs text-slate-600">Important: we&apos;ll send quote updates, payment links and driver details by email. Please check your junk/spam folder if you don&apos;t see our emails.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/customer/register?returnTo=/quote"
              onClick={() => {
                if (formRef.current) saveDraftToSessionStorage(buildDraftFromForm(formRef.current));
                trackAnalyticsEvent("QUOTE_REGISTER_CLICKED", "/quote");
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Create account
            </Link>
            <Link
              href="/customer/login?returnTo=/quote"
              onClick={() => {
                if (formRef.current) saveDraftToSessionStorage(buildDraftFromForm(formRef.current));
                trackAnalyticsEvent("QUOTE_SIGNIN_CLICKED", "/quote");
              }}
              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function InputField({ label, name, type = "text", required, min, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; min?: number; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} min={min} placeholder={placeholder} defaultValue={defaultValue || ""} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2" />
    </div>
  );
}

function SelectField({ label, name, options, required, defaultValue }: { label: string; name: string; options: string[]; required?: boolean; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={name}>{label}</label>
      <select id={name} name={name} required={required} defaultValue={defaultValue || (options[0] === "No" || options[0] === "Yes" ? options[0] : "")} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2">
        {options[0] !== "No" && options[0] !== "Yes" ? <option value="">Select an option</option> : null}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
