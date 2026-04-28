import type { Metadata } from "next";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Airport Transfers",
  description: "Private airport transfers between Belfast International, Belfast City, Dublin Airport, and destinations across Northern Ireland.",
};

export default function AirportTransfersPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10">
        <h1 className="text-4xl font-bold">Airport Transfers</h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          Pre-booked private transfers designed for smooth arrivals and departures at Belfast International Airport, George Best Belfast City Airport, and Dublin Airport.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-semibold">Belfast International Airport</h2>
          <p className="mt-3 text-slate-600">Direct transport to Belfast city center, regional hotels, golf resorts, and event venues.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-semibold">George Best Belfast City Airport</h2>
          <p className="mt-3 text-slate-600">Ideal for short-haul business and leisure travel requiring efficient city and regional connections.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-semibold">Dublin Airport</h2>
          <p className="mt-3 text-slate-600">Reliable cross-border transfers with professional scheduling for international arrivals.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-3xl font-bold">Common Transfers</h2>
        <ul className="mt-4 space-y-2 text-slate-700">
          <li>Belfast International Airport to Belfast hotels and city center</li>
          <li>Belfast City Airport to Belfast conference venues</li>
          <li>Dublin Airport to Belfast private transfer</li>
          <li>Dublin Airport to North Coast and golf destinations</li>
        </ul>
      </section>

      <CTASection
        title="Book a Professional Airport Transfer"
        description="Send your flight and destination details and we will prepare a clear, pre-booked transfer quote."
        ctaLabel="Request a Quote"
        ctaHref="/quote"
      />
    </div>
  );
}
