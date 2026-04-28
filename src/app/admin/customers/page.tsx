"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; email: string; customerProfile?: { name: string; accountType: string; country: string }; quotes: Array<{ id: string; status: string }> };

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    fetch("/api/admin/customers").then(async (res) => {
      const data = await res.json();
      if (!res.ok) return;
      setCustomers(data.customers || []);
    });
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Customers</h1>
      <ul className="space-y-3">
        {customers.map((customer) => (
          <li key={customer.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p><strong>{customer.customerProfile?.name || "Unknown"}</strong> ({customer.email})</p>
            <p>{customer.customerProfile?.accountType} - {customer.customerProfile?.country}</p>
            <p>Recent quotes: {customer.quotes.length}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
