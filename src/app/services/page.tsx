import type { Metadata } from "next";
import CTASection from "@/components/CTASection";
import ServiceCard from "@/components/ServiceCard";
import { serviceDetails } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore NI Taxi Co private hire services for airport, golf, tours, event, corporate, and operator bookings.",
};

export default function ServicesPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10">
        <h1 className="text-4xl font-bold">Private Hire Services</h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          NI Taxi Co provides pre-booked transport solutions for visitors, golfers, business travelers, and tour partners across Northern Ireland.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {serviceDetails.map((service) => (
          <ServiceCard key={service.title} title={service.title} description={service.description} />
        ))}
      </section>

      <CTASection
        title="Need a Tailored Transport Plan?"
        description="Share your itinerary and we will create a quote aligned to your schedule, group size, and service expectations."
        ctaLabel="Request a Quote"
        ctaHref="/quote"
      />
    </div>
  );
}
