"use client";

import { FormEvent, useEffect, useState } from "react";

interface DriverProfile {
  name: string;
  email: string;
  mobile: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  carMake: string;
  carModel: string;
  registrationNumber: string;
  passengerCapacity: number;
  suitcaseCapacity: number;
  profilePhoto?: string | null;
}

export default function DriverProfilePage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    fetch("/api/driver/profile").then(async (res) => {
      const data = (await res.json()) as { message?: string; profile?: DriverProfile };
      if (!res.ok) setError(data.message || "Unable to load profile");
      else setProfile(data.profile || null);
    });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    const res = await fetch("/api/driver/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { message?: string; profile?: DriverProfile };
    if (!res.ok) {
      setError(data.message || "Update failed");
      return;
    }
    setProfile(data.profile || null);
    setSaved("Profile updated.");
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!profile) return <p>Loading...</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Driver Profile</h1>
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        {[
          ["name", "Name"], ["email", "Email"], ["mobile", "Mobile"], ["addressLine1", "Address line 1"], ["addressLine2", "Address line 2"], ["city", "City"], ["region", "Region"], ["postalCode", "Postal code"], ["country", "Country"], ["carMake", "Car make"], ["carModel", "Car model"], ["registrationNumber", "Registration number"], ["passengerCapacity", "Passenger capacity"], ["suitcaseCapacity", "Suitcase capacity"], ["profilePhoto", "Profile photo URL"],
        ].map(([name, label]) => (
          <div key={name}>
            <label className="mb-1 block text-sm">{label}</label>
            <input name={name} defaultValue={profile[name as keyof DriverProfile] as string | number | undefined} className="w-full rounded border border-slate-300 px-3 py-2" />
          </div>
        ))}
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-white">Save profile</button>
        </div>
      </form>
      {saved && <p className="text-emerald-700">{saved}</p>}
    </section>
  );
}
