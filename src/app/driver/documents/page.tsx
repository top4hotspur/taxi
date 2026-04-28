"use client";

import { FormEvent, useEffect, useState } from "react";

interface DriverDocument {
  id: string;
  type: string;
  status: string;
  uploadedFileReference: string;
  expiryDate?: string | null;
}

const TYPES = ["TAXI_LICENCE", "TAXI_CAR_LICENCE", "INSURANCE", "DRIVING_LICENCE"];

export default function DriverDocumentsPage() {
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/driver/documents").then(async (res) => {
      const data = (await res.json()) as { message?: string; documents?: DriverDocument[] };
      if (!res.ok) setError(data.message || "Unable to load documents");
      else setDocuments(data.documents || []);
    });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const res = await fetch("/api/driver/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Upload failed");
      return;
    }

    const refreshed = await fetch("/api/driver/documents");
    const refreshedData = (await refreshed.json()) as { documents?: DriverDocument[] };
    setDocuments(refreshedData.documents || []);
    event.currentTarget.reset();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Driver Documents</h1>
      {error && <p className="text-red-700">{error}</p>}

      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm">Document type</label>
          <select name="type" required className="w-full rounded border border-slate-300 px-3 py-2">
            <option value="">Select type</option>
            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm">File name (for storage key)</label>
          <input name="fileName" placeholder="insurance.pdf" className="w-full rounded border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm">Uploaded file reference (optional)</label>
          <input name="uploadedFileReference" placeholder="s3://... or storage key" className="w-full rounded border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm">Expiry date (optional)</label>
          <input name="expiryDate" type="date" className="w-full rounded border border-slate-300 px-3 py-2" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-white">Save document</button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">Current documents</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded border border-slate-200 p-3">
              <p><strong>{doc.type}</strong> - {doc.status}</p>
              <p>Reference: {doc.uploadedFileReference}</p>
              <p>Expiry: {doc.expiryDate || "N/A"}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
