"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DriverListItem {
  profile: { id: string; name: string; email: string; status: string };
  missingDocuments: string[];
  expiredDocuments: string[];
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/drivers").then(async (res) => {
      const data = (await res.json()) as { drivers?: DriverListItem[] };
      if (res.ok) setDrivers(data.drivers || []);
    });
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Drivers</h1>
      <ul className="space-y-3">
        {drivers.map((item) => (
          <li key={item.profile.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p><strong>{item.profile.name}</strong> ({item.profile.email})</p>
            <p>Status: {item.profile.status}</p>
            <p>Missing docs: {item.missingDocuments.length ? item.missingDocuments.join(", ") : "None"}</p>
            <p>Expired docs: {item.expiredDocuments.length ? item.expiredDocuments.join(", ") : "None"}</p>
            <Link href={`/admin/drivers/${item.profile.id}`} className="mt-2 inline-block underline">Review driver</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
