"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

interface DriverProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  carMake: string;
  carModel: string;
  registrationNumber: string;
  passengerCapacity: number;
  suitcaseCapacity: number;
  status: string;
}

interface DriverDocument {
  id: string;
  type: string;
  status: string;
  uploadedFileReference: string;
  expiryDate?: string | null;
}

export default function AdminDriverDetailPage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/admin/drivers/${params.id}`).then(async (res) => {
      const data = (await res.json()) as { message?: string; profile?: DriverProfile; documents?: DriverDocument[] };
      if (!res.ok) {
        setError(data.message || "Unable to load driver");
        return;
      }
      setProfile(data.profile || null);
      setDocuments(data.documents || []);
    });
  }, [params.id]);

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const status = new FormData(event.currentTarget).get("status");
    const res = await fetch(`/api/admin/drivers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message || "Unable to update status");
    setProfile(data.profile || null);
  }

  async function reviewDocument(docId: string, status: string) {
    const res = await fetch(`/api/admin/drivers/${params.id}/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;

    const reload = await fetch(`/api/admin/drivers/${params.id}`);
    const data = await reload.json();
    setProfile(data.profile || null);
    setDocuments(data.documents || []);
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!profile) return <p>Loading...</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Driver Review: {profile.name}</h1>
      <article className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <p>Email: {profile.email}</p>
        <p>Mobile: {profile.mobile}</p>
        <p>Vehicle: {profile.carMake} {profile.carModel} ({profile.registrationNumber})</p>
        <p>Capacity: {profile.passengerCapacity} passengers / {profile.suitcaseCapacity} suitcases</p>
      </article>

      <form onSubmit={updateStatus} className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="mb-1 block text-sm">Driver status</label>
        <select name="status" defaultValue={profile.status} className="rounded border border-slate-300 px-3 py-2">
          {["PENDING", "INCOMPLETE", "ACTIVE", "SUSPENDED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit" className="ml-3 rounded bg-slate-900 px-4 py-2 text-sm text-white">Save status</button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">Documents</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded border border-slate-200 p-3">
              <p><strong>{doc.type}</strong> - {doc.status}</p>
              <p>Reference: {doc.uploadedFileReference}</p>
              <p>Expiry: {doc.expiryDate || "N/A"}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => reviewDocument(doc.id, "APPROVED")} className="rounded bg-emerald-700 px-3 py-1 text-white">Approve</button>
                <button onClick={() => reviewDocument(doc.id, "REJECTED")} className="rounded bg-red-700 px-3 py-1 text-white">Reject</button>
                <button onClick={() => reviewDocument(doc.id, "EXPIRED")} className="rounded bg-amber-700 px-3 py-1 text-white">Mark expired</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
