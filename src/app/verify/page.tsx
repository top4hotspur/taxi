import type { Metadata } from "next";
import { siteConfig } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: "Business Verification",
  description: "Public business verification details for NI Taxi Co.",
  alternates: {
    canonical: "/verify",
  },
};

export default function VerifyPage() {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">NI Taxi Co</h1>
      <div className="mt-4 space-y-2 text-sm text-slate-800">
        <p>Registered Company Number: {siteConfig.companyNumber}</p>
        <p>Contact email: {siteConfig.email}</p>
        <p>Phone: {siteConfig.phone}</p>
        <p>Website: {siteConfig.url}</p>
        <p>Service area: Northern Ireland</p>
        <p>This page is public for business verification.</p>
      </div>
    </section>
  );
}

