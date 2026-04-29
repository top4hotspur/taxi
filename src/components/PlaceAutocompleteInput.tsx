"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: {
              fields?: string[];
              componentRestrictions?: { country: string[] };
              types?: string[];
            }
          ) => {
            addListener: (eventName: string, callback: () => void) => void;
            getPlace: () => {
              place_id?: string;
              name?: string;
              formatted_address?: string;
              geometry?: { location?: { lat: () => number; lng: () => number } };
            };
          };
        };
      };
    };
    gm_authFailure?: () => void;
  }
}

const SCRIPT_ID = "google-maps-places-script";
const COMPONENT_NAME = "PlaceAutocompleteInput";

type DiagnosticReason =
  | "API_KEY_MISSING"
  | "SCRIPT_LOAD_FAILED"
  | "PLACES_UNAVAILABLE"
  | "AUTH_OR_REFERRER_ERROR"
  | "PROJECT_OR_BILLING_ERROR"
  | null;

function diagnosticMessage(reason: DiagnosticReason): string {
  switch (reason) {
    case "API_KEY_MISSING":
      return "Google Maps key is missing.";
    case "SCRIPT_LOAD_FAILED":
      return "Google Maps script failed to load.";
    case "PLACES_UNAVAILABLE":
      return "Google Places library is unavailable.";
    case "AUTH_OR_REFERRER_ERROR":
      return "Google Maps auth/referrer restriction issue detected.";
    case "PROJECT_OR_BILLING_ERROR":
      return "Google Cloud project, billing, or API enablement issue detected.";
    default:
      return "";
  }
}

function loadGooglePlacesScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("SCRIPT_LOAD_FAILED")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("SCRIPT_LOAD_FAILED")), { once: true });
    document.head.appendChild(script);
  });
}

interface PlaceAutocompleteInputProps {
  label: string;
  required?: boolean;
  locationNameField: string;
  placeIdField: string;
  addressField: string;
  latField: string;
  lngField: string;
}

export default function PlaceAutocompleteInput(props: PlaceAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [scriptReady, setScriptReady] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedLat, setSelectedLat] = useState("");
  const [selectedLng, setSelectedLng] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [diagReason, setDiagReason] = useState<DiagnosticReason>(apiKey ? null : "API_KEY_MISSING");
  const [diagDetail, setDiagDetail] = useState<string | null>(apiKey ? null : "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
  const isDebugMode = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      if (!event.message) return;
      const lower = event.message.toLowerCase();
      if (lower.includes("google maps") || lower.includes("referernotallowedmaperror") || lower.includes("apikey") || lower.includes("billingnotenabledmaperror")) {
        let reason: DiagnosticReason = "PROJECT_OR_BILLING_ERROR";
        if (lower.includes("referernotallowedmaperror") || lower.includes("invalidkeymaperror") || lower.includes("apikey")) {
          reason = "AUTH_OR_REFERRER_ERROR";
        }
        setDiagReason(reason);
        setDiagDetail(event.message);
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonText = String(event.reason ?? "");
      const lower = reasonText.toLowerCase();
      if (lower.includes("google") || lower.includes("maps") || lower.includes("places")) {
        setDiagReason("PROJECT_OR_BILLING_ERROR");
        setDiagDetail(reasonText);
      }
    };

    window.gm_authFailure = () => {
      setDiagReason("AUTH_OR_REFERRER_ERROR");
      setDiagDetail("gm_authFailure triggered by Google Maps.");
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      delete window.gm_authFailure;
    };
  }, []);

  useEffect(() => {
    if (!apiKey) return;

    loadGooglePlacesScript(apiKey)
      .then(() => {
        if (!window.google?.maps) {
          setDiagReason("SCRIPT_LOAD_FAILED");
          setDiagDetail("Google Maps object missing after script load.");
          return;
        }

        if (!window.google.maps.places?.Autocomplete) {
          setDiagReason("PLACES_UNAVAILABLE");
          setDiagDetail("Places library unavailable after script load.");
          return;
        }

        setScriptReady(true);
        setDiagReason(null);
        setDiagDetail(null);
      })
      .catch((error) => {
        setDiagReason("SCRIPT_LOAD_FAILED");
        setDiagDetail(error instanceof Error ? error.message : "Unknown script load error");
      });
  }, [apiKey]);

  useEffect(() => {
    if (!scriptReady || !inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["place_id", "formatted_address", "name", "geometry"],
      componentRestrictions: { country: ["gb", "ie"] },
      types: ["geocode"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      setSelectedPlaceId(place.place_id || "");
      setSelectedAddress(place.formatted_address || "");
      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();
      setSelectedLat(typeof lat === "number" ? String(lat) : "");
      setSelectedLng(typeof lng === "number" ? String(lng) : "");

      const input = inputRef.current;
      if (place.name && input && !input.value.trim()) {
        input.value = place.name;
      }
    });
  }, [scriptReady]);

  useEffect(() => {
    const hasGoogle = Boolean(window.google?.maps);
    const hasPlaces = Boolean(window.google?.maps?.places?.Autocomplete);
    const message = diagDetail || diagnosticMessage(diagReason);

    console.warn("[place-autocomplete-diagnostics]", {
      component: COMPONENT_NAME,
      fieldName: props.locationNameField,
      scriptLoaded: scriptReady,
      hasGoogle,
      hasPlaces,
      diagnosticReason: diagReason,
      error: message || null,
    });
  }, [diagDetail, diagReason, props.locationNameField, scriptReady]);

  const showFallback = !scriptReady;
  const fallbackReason = diagDetail || diagnosticMessage(diagReason);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={inputId}>
        {props.label}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        name={props.locationNameField}
        required={props.required}
        placeholder={showFallback ? "Enter location manually" : "Search location"}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-400 transition focus:ring-2"
      />
      <input type="hidden" name={props.placeIdField} value={selectedPlaceId} />
      <input type="hidden" name={props.addressField} value={selectedAddress} />
      <input type="hidden" name={props.latField} value={selectedLat} />
      <input type="hidden" name={props.lngField} value={selectedLng} />
      {showFallback && (
        <p className="mt-1 text-xs text-slate-600">Address search unavailable - manual entry is still supported.</p>
      )}
      {showFallback && isDebugMode && fallbackReason && (
        <p className="mt-1 text-xs text-slate-500">Diagnostics: {fallbackReason}</p>
      )}
    </div>
  );
}
