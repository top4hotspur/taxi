import type { Metadata } from "next";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Tours",
  description: "Private day tours from Belfast including Giant's Causeway routes, North Coast journeys, and tailored itineraries.",
};

const tourOptions = [
  "Giant's Causeway and North Coast routes",
  "Belfast city tours",
  "Scenic routes including filming-location style experiences",
  "Custom itinerary trips for private groups",
];

export default function ToursPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10">
        <h1 className="text-4xl font-bold">Private Tours</h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          Discover Northern Ireland with private touring designed around your schedule, preferred stops, and travel pace.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-3xl font-bold">Tour Highlights</h2>
        <ul className="mt-4 space-y-2 text-slate-700">
          {tourOptions.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-2xl font-semibold">North Coast and Causeway Days</h3>
          <p className="mt-3 text-slate-600">Comfortable private travel for iconic coastal routes, photography stops, and scenic landmarks.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-2xl font-semibold">Custom Itineraries</h3>
          <p className="mt-3 text-slate-600">Ideal for families, couples, and operators building flexible day trips with multiple destinations.</p>
        </article>
      </section>

      <CTASection
        title="Request a Tailored Tour Quote"
        description="Tell us where you would like to go, and we will propose a private tour transfer plan."
        ctaLabel="Request a Quote"
        ctaHref="/quote"
      />
    </div>
  );
}
