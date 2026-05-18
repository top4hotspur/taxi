import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | NI Taxi Co",
  description: "Contact NI Taxi Co for private hire and pre-booked taxi and transfer services across Northern Ireland.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-bold text-slate-900">Contact</h1>
      <p className="text-slate-700">NI Taxi Co provides private hire and pre-booked taxi and transfer services across Northern Ireland.</p>
      <p className="text-sm text-slate-700"><strong>Business:</strong> NI Taxi Co</p>
      <p className="text-sm text-slate-700"><strong>Email:</strong> contact@nitaxico.com</p>
      <p className="text-sm text-slate-700"><strong>Phone:</strong> 07440368474</p>
      <p className="text-sm text-slate-700"><strong>Registered Company Number:</strong> NI721173</p>
      <p className="text-sm text-slate-700"><strong>Service area:</strong> Northern Ireland</p>
    </section>
  );
}
