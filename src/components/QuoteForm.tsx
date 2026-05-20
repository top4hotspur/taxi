"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

const serviceTypes = ["Airport Transfer", "Golf Transfer", "Tourist Day Trip", "Event Transport", "Other"];
const quickLocations = [
  { label: "Belfast International - BFS", value: "Belfast International Airport, Crumlin, UK" },
  { label: "City Airport - BHD", value: "Belfast City Airport, Sydenham By-Pass, Belfast, UK" },
  { label: "Grand Central Station", value: "Belfast BT12 5AP, UK" },
];
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
    const draft = JSON.parse(raw) as Record<string, string>;
    window.sessionStorage.removeItem(QUOTE_DRAFT_KEY);
    return draft;
  } catch {
    window.sessionStorage.removeItem(QUOTE_DRAFT_KEY);
    return {} as Record<string, string>;
  }
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
};

function isAirportLocation(value: string) {
  return value.toLowerCase().includes("airport");
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
  const [customerContext, setCustomerContext] = useState({ loggedInCustomer: false, email: "", name: "", phone: "" });
  const [showLoginRequired, setShowLoginRequired] = useState(false);

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

  function markPotentiallyStale(fieldName: string) {
    if (!estimate || !pricingRelevantFields.has(fieldName)) return;
    if (!estimateStale) {
      setEstimateStale(true);
      trackAnalyticsEvent("QUOTE_ESTIMATE_STALE", "/quote");
    }
  }

  function resetReturnToReverse() {
    if (!formRef.current) return;
    const outwardPickup = formRef.current.querySelector<HTMLInputElement>('input[name="pickupLocation"]')?.value || "";
    const outwardDropoff = formRef.current.querySelector<HTMLInputElement>('input[name="dropoffLocation"]')?.value || "";
    const returnPickup = formRef.current.querySelector<HTMLInputElement>('input[name="returnPickupLocation"]');
    const returnDropoff = formRef.current.querySelector<HTMLInputElement>('input[name="returnDropoffLocation"]');
    if (returnPickup) returnPickup.value = outwardDropoff;
    if (returnDropoff) returnDropoff.value = outwardPickup;
    setFormState((current) => ({ ...current, returnPickupLocation: outwardDropoff, returnDropoffLocation: outwardPickup }));
  }

  function setFieldValue(name: string, value: string) {
    if (!formRef.current) return;
    const input = formRef.current.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (input) input.value = value;
  }

  function applyQuickLocation(params: {
    locationField: string;
    placeIdField: string;
    addressField: string;
    latField: string;
    lngField: string;
    value: string;
  }) {
    setFieldValue(params.locationField, params.value);
    setFieldValue(params.placeIdField, "");
    setFieldValue(params.addressField, "");
    setFieldValue(params.latField, "");
    setFieldValue(params.lngField, "");
    setFormState((current) => ({
      ...current,
      [params.locationField]: params.value,
      [params.placeIdField]: "",
      [params.addressField]: "",
      [params.latField]: "",
      [params.lngField]: "",
    }));
    markPotentiallyStale(params.locationField);
  }

  async function calculateEstimate() {
    if (!formRef.current) return;
    setEstimating(true);
    setEstimateError("");
    const fd = new FormData(formRef.current);
    const payload = {
      pickupLocation: String(fd.get("pickupLocation") || ""),
      pickupPlaceId: String(fd.get("pickupPlaceId") || ""),
      pickupLat: String(fd.get("pickupLat") || ""),
      pickupLng: String(fd.get("pickupLng") || ""),
      dropoffLocation: String(fd.get("dropoffLocation") || ""),
      dropoffPlaceId: String(fd.get("dropoffPlaceId") || ""),
      dropoffLat: String(fd.get("dropoffLat") || ""),
      dropoffLng: String(fd.get("dropoffLng") || ""),
      returnJourney: returnJourneyNeeded ? "Yes" : "No",
      returnPickupLocation: String(fd.get("returnPickupLocation") || ""),
      returnPickupPlaceId: String(fd.get("returnPickupPlaceId") || ""),
      returnPickupLat: String(fd.get("returnPickupLat") || ""),
      returnPickupLng: String(fd.get("returnPickupLng") || ""),
      returnDropoffLocation: String(fd.get("returnDropoffLocation") || ""),
      returnDropoffPlaceId: String(fd.get("returnDropoffPlaceId") || ""),
      returnDropoffLat: String(fd.get("returnDropoffLat") || ""),
      returnDropoffLng: String(fd.get("returnDropoffLng") || ""),
      returnDate: String(fd.get("returnDate") || ""),
      returnTime: String(fd.get("returnTime") || ""),
      serviceType: String(fd.get("serviceType") || ""),
      pickupDate: String(fd.get("pickupDate") || ""),
      pickupTime: String(fd.get("pickupTime") || ""),
      passengers: String(fd.get("passengers") || ""),
      oversizeItemCount: String(fd.get("oversizeItemCount") || "0"),
      itineraryMessage: String(fd.get("itineraryMessage") || ""),
    };
    try {
      const response = await fetch("/api/pricing/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as EstimateResponse;
      if (!response.ok) throw new Error("Unable to calculate estimate right now.");
      setEstimate(result);
      setEstimateStale(false);
      trackAnalyticsEvent("QUOTE_ESTIMATE_RECALCULATED", "/quote");
      if (result.manualGroupQuote) {
        setEstimateError(result.customerMessage || "We can't estimate prices online for groups larger than 8 passengers. Please submit your request and we'll be in touch shortly with a tailored quote.");
      } else if (result.routeEstimateFailed) {
        setEstimateError(result.customerMessage || "We couldn't calculate this route automatically. Submit your request and we'll confirm the price manually.");
      }
    } catch {
      setEstimateError("Unable to calculate estimate right now.");
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerContext.loggedInCustomer) {
      const fd = new FormData(event.currentTarget);
      const draft = Object.fromEntries(Array.from(fd.entries()).map(([key, value]) => [key, String(value)]));
      window.sessionStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(draft));
      setShowLoginRequired(true);
      setStatus("error");
      setMessage("Please create an account or sign in before submitting your quote so you can view, accept and pay for it later.");
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
      pricingSource: estimate?.pricingSource || "",
      requiresManualReview: Boolean(estimate?.requiresManualReview || estimateStale),
      pricingCalculatedAt: estimate ? new Date().toISOString() : "",
      routeEstimateFailed: Boolean(estimate?.routeEstimateFailed || estimateStale),
      routeEstimateFailureReason: String(estimateStale ? "Journey details changed after estimate." : estimate?.routeEstimateFailureReason || ""),
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
      {!customerContext.loggedInCustomer ? (
        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
          <h2 className="text-lg font-semibold text-slate-900">Create an account to request your quote</h2>
          <p>Your quote, confirmed price, payment link and driver details will be saved in your account.</p>
          <p>To request a quote, please create an account or sign in. This lets you return later to view your confirmed price, accept the quote, pay securely, and receive driver details.</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/customer/register?returnTo=/quote"
              onClick={() => trackAnalyticsEvent("QUOTE_REGISTER_CLICKED", "/quote")}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Create account
            </Link>
            <Link
              href="/customer/login?returnTo=/quote"
              onClick={() => trackAnalyticsEvent("QUOTE_SIGNIN_CLICKED", "/quote")}
              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
            >
              Sign in
            </Link>
          </div>
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
            <PlaceAutocompleteInput label="Outward pickup location" required locationNameField="pickupLocation" placeIdField="pickupPlaceId" addressField="pickupAddress" latField="pickupLat" lngField="pickupLng" defaultValue={formState.pickupLocation || ""} />
            {outwardAirportPickup ? (
              <div className="space-y-1">
                <InputField label="Flight number" name="outwardFlightNumber" placeholder="e.g. EI123, BA1416" defaultValue={formState.outwardFlightNumber || ""} />
                <p className="text-xs text-slate-500">This helps us monitor arrivals and plan pickup timing.</p>
              </div>
            ) : null}
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Quick select:</p>
              <div className="flex flex-wrap gap-2">
                {quickLocations.map((location) => (
                  <button
                    key={`pickup-${location.label}`}
                    type="button"
                    aria-label={`Set pickup location to ${location.label}`}
                    onClick={() =>
                      applyQuickLocation({
                        locationField: "pickupLocation",
                        placeIdField: "pickupPlaceId",
                        addressField: "pickupAddress",
                        latField: "pickupLat",
                        lngField: "pickupLng",
                        value: location.value,
                      })
                    }
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {location.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <PlaceAutocompleteInput label="Outward drop-off location" required locationNameField="dropoffLocation" placeIdField="dropoffPlaceId" addressField="dropoffAddress" latField="dropoffLat" lngField="dropoffLng" defaultValue={formState.dropoffLocation || ""} />
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Quick select:</p>
              <div className="flex flex-wrap gap-2">
                {quickLocations.map((location) => (
                  <button
                    key={`dropoff-${location.label}`}
                    type="button"
                    aria-label={`Set drop-off location to ${location.label}`}
                    onClick={() =>
                      applyQuickLocation({
                        locationField: "dropoffLocation",
                        placeIdField: "dropoffPlaceId",
                        addressField: "dropoffAddress",
                        latField: "dropoffLat",
                        lngField: "dropoffLng",
                        value: location.value,
                      })
                    }
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {location.label}
                  </button>
                ))}
              </div>
            </div>
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
              <PlaceAutocompleteInput label="Return pickup location" required locationNameField="returnPickupLocation" placeIdField="returnPickupPlaceId" addressField="returnPickupAddress" latField="returnPickupLat" lngField="returnPickupLng" defaultValueFieldName="dropoffLocation" defaultValue={formState.returnPickupLocation || ""} />
              {returnAirportPickup ? <InputField label="Return flight number" name="returnFlightNumber" placeholder="e.g. EI123, BA1416" defaultValue={formState.returnFlightNumber || ""} /> : null}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Quick select:</p>
                <div className="flex flex-wrap gap-2">
                  {quickLocations.map((location) => (
                    <button
                      key={`return-pickup-${location.label}`}
                      type="button"
                      aria-label={`Set return pickup location to ${location.label}`}
                      onClick={() =>
                        applyQuickLocation({
                          locationField: "returnPickupLocation",
                          placeIdField: "returnPickupPlaceId",
                          addressField: "returnPickupAddress",
                          latField: "returnPickupLat",
                          lngField: "returnPickupLng",
                          value: location.value,
                        })
                      }
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {location.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <PlaceAutocompleteInput label="Return drop-off location" required locationNameField="returnDropoffLocation" placeIdField="returnDropoffPlaceId" addressField="returnDropoffAddress" latField="returnDropoffLat" lngField="returnDropoffLng" defaultValueFieldName="pickupLocation" defaultValue={formState.returnDropoffLocation || ""} />
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Quick select:</p>
                <div className="flex flex-wrap gap-2">
                  {quickLocations.map((location) => (
                    <button
                      key={`return-dropoff-${location.label}`}
                      type="button"
                      aria-label={`Set return drop-off location to ${location.label}`}
                      onClick={() =>
                        applyQuickLocation({
                          locationField: "returnDropoffLocation",
                          placeIdField: "returnDropoffPlaceId",
                          addressField: "returnDropoffAddress",
                          latField: "returnDropoffLat",
                          lngField: "returnDropoffLng",
                          value: location.value,
                        })
                      }
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {location.label}
                    </button>
                  ))}
                </div>
              </div>
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
              <InputField label="Lead passenger email address" name="leadPassengerEmail" type="email" required defaultValue={formState.leadPassengerEmail || ""} />
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
        <button type="button" onClick={calculateEstimate} disabled={estimating || !canCalculate} className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
          {estimating ? "Calculating..." : "Calculate estimated price"}
        </button>
        {estimateStale && <p className="text-sm font-medium text-amber-700">Journey details changed. Please recalculate before submitting.</p>}
        {estimateError && <p className="text-sm text-red-700">{estimateError}</p>}
        {estimate?.ok && (
          <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900">
            {estimate.manualGroupQuote ? (
              <p className="font-medium text-amber-900">We can&apos;t estimate prices online for groups larger than 8 passengers. Please submit your request and we&apos;ll be in touch shortly with a tailored quote.</p>
            ) : returnJourneyNeeded ? (
              <>
                <p className="text-lg font-semibold">Estimated return fare: {estimate.finalEstimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Outward journey: {estimate.outwardEstimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Return journey: {estimate.returnEstimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Return booking discount 10%: -{estimate.returnDiscountAmount ?? "N/A"} {estimate.currency || ""}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">Estimated fare: {estimate.finalEstimatedFare ?? estimate.estimatedFare ?? "N/A"} {estimate.currency || ""}</p>
                <p>Distance: {estimate.distanceMiles ?? "N/A"} {estimate.distanceMiles !== null && estimate.distanceMiles !== undefined ? "miles" : ""}</p>
                <p>Journey time: {estimate.durationMinutes ?? "N/A"} {estimate.durationMinutes !== null && estimate.durationMinutes !== undefined ? "minutes" : ""}</p>
                <p>{estimate.fareBreakdown?.["airportSurchargeApplied"] ? "Airport surcharge included." : ""}</p>
                <p>{estimate.fareBreakdown?.["passengerUpliftPercent"] ? "Passenger uplift included." : ""}</p>
              </>
            )}
            <p className="mt-2 text-slate-700">Subject to driver availability and final confirmation.</p>
          </article>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" name="termsAccepted" value="true" required className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            I have read and agree to the <Link href="/terms" className="font-semibold underline" target="_blank">Terms &amp; Conditions</Link> and <Link href="/policies" className="font-semibold underline" target="_blank">Policies</Link>.
          </span>
        </label>
      </section>

      <button type="submit" disabled={status === "loading"} className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
        {status === "loading" ? "Submitting..." : "Submit Quote Request"}
      </button>
      {message && <p className="text-sm text-red-700">{message}</p>}
      {showLoginRequired && !customerContext.loggedInCustomer ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>Please create an account or sign in before submitting your quote so you can view, accept and pay for it later.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/customer/register?returnTo=/quote"
              onClick={() => trackAnalyticsEvent("QUOTE_REGISTER_CLICKED", "/quote")}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Create account
            </Link>
            <Link
              href="/customer/login?returnTo=/quote"
              onClick={() => trackAnalyticsEvent("QUOTE_SIGNIN_CLICKED", "/quote")}
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
