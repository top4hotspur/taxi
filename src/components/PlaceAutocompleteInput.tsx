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
  }
}

const SCRIPT_ID = "google-maps-places-script";

function loadGooglePlacesScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")), { once: true });
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
  const [scriptFailed, setScriptFailed] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedLat, setSelectedLat] = useState("");
  const [selectedLng, setSelectedLng] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    loadGooglePlacesScript(apiKey)
      .then(() => setScriptReady(true))
      .catch(() => setScriptFailed(true));
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

  const showFallback = !apiKey || scriptFailed;

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
      {showFallback && <p className="mt-1 text-xs text-slate-600">Autocomplete unavailable. Manual entry is enabled.</p>}
    </div>
  );
}
