"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface DriverProfile {
  id: string;
  status: string;
}

interface DriverDocument {
  id: string;
  type: string;
}

const REQUIRED_TYPES = ["TAXI_LICENCE", "TAXI_CAR_LICENCE", "INSURANCE", "DRIVING_LICENCE"];

export default function DriverPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);

  useEffect(() => {
    fetch("/api/driver/me").then(async (res) => {
      const data = (await res.json()) as { message?: string; profile?: DriverProfile; documents?: DriverDocument[] };
      if (!res.ok) {
        setError(data.message || "Driver login required.");
      } else {
        setProfile(data.profile || null);
        setDocuments(data.documents || []);
      }
      setLoading(false);
    });
  }, []);

  const completion = useMemo(() => {
    const uploaded = new Set(documents.map((d) => d.type));
    const done = REQUIRED_TYPES.filter((type) => uploaded.has(type)).length;
    return Math.round((done / REQUIRED_TYPES.length) * 100);
  }, [documents]);

  if (loading) return <p>Loading driver dashboard...</p>;
  if (error) return <p className="text-red-700">{error}</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Driver Dashboard</h1>
      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Onboarding completion</p>
        <p className="mt-2 text-2xl font-semibold">{completion}%</p>
        <p className="mt-2 text-sm text-slate-700">Status: <strong>{profile?.status || "INCOMPLETE"}</strong></p>
      </article>

      <div className="flex flex-wrap gap-3">
        <Link href="/driver/profile" className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">Driver Profile</Link>
        <Link href="/driver/documents" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Driver Documents</Link>
        <Link href="/driver/availability" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Availability (Placeholder)</Link>
      </div>
    </section>
  );
}
