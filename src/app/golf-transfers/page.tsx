import type { Metadata } from "next";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Golf Transfers",
  description: "Premium golf transfer services in Northern Ireland for individual golfers, groups, and international tour operators.",
};

const golfLocations = [
  "Royal Portrush",
  "Royal County Down",
  "Portstewart",
  "Ardglass",
  "Malone, Belvoir, and Belfast area courses",
];

export default function GolfTransfersPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10">
        <h1 className="text-4xl font-bold">Golf Transfers</h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          NI Taxi Co supports golf tourists and travel planners with premium, itinerary-focused transfer services across Northern Ireland.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-3xl font-bold">Course Access Across Northern Ireland</h2>
        <ul className="mt-4 space-y-2 text-slate-700">
          {golfLocations.map((location) => (
            <li key={location}>{location}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-2xl font-semibold">Tour Operator Ready</h3>
          <p className="mt-3 text-slate-600">Suitable for inbound golf travel programs requiring dependable transfers between airports, hotels, and tee times.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-2xl font-semibold">Luggage and Golf Bag Planning</h3>
          <p className="mt-3 text-slate-600">Quote requests can include full baggage details to match the right vehicle and route plan.</p>
        </article>
      </section>

      <CTASection
        title="Arrange Your Golf Transfer Schedule"
        description="Share your course plan and travel dates to receive a tailored golf transfer quote."
        ctaLabel="Request a Quote"
        ctaHref="/quote"
      />
    </div>
  );
}
