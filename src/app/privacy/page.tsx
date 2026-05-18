import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | NI Taxi Co",
  description: "Read how NI Taxi Co uses and protects personal information for quote requests and bookings.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="text-slate-700">NI Taxi Co uses your personal information to process quote requests, manage bookings, communicate journey updates, and provide customer support.</p>
      <p className="text-slate-700">We only collect details needed to deliver transport services, such as contact details, pickup/drop-off information, and journey preferences.</p>
      <p className="text-slate-700">Where needed, relevant booking details may be shared with trusted drivers or service partners involved in delivering your journey.</p>
      <p className="text-slate-700">We do not sell personal data and we do not use your information for unrelated purposes without a lawful basis.</p>
      <p className="text-slate-700">For privacy enquiries, contact <a className="underline" href="mailto:contact@nitaxico.com">contact@nitaxico.com</a>.</p>
    </section>
  );
}
