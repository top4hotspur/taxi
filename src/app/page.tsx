import Link from "next/link";
import type { Metadata } from "next";
import CTASection from "@/components/CTASection";
import Hero from "@/components/Hero";
import ServiceCard from "@/components/ServiceCard";
import { featuredServices, popularRoutes, trustPoints } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: "Private Taxi & Tour Transfers Across Northern Ireland",
  description:
    "Premium pre-booked airport transfers, golf transport, and private tours in Northern Ireland for visitors and tour operators.",
};

export default function Home() {
  return (
    <div className="space-y-14">
      <Hero
        title="Private Taxi & Tour Transfers Across Northern Ireland"
        subtitle="Premium pre-booked transport for tourists, golfers, airport passengers, and tour operators needing dependable local expertise."
        primaryCta={{ label: "Request a Quote", href: "/quote" }}
        secondaryCta={{ label: "Airport Transfers", href: "/airport-transfers" }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/quote" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Request a Quote
          </Link>
          <Link href="/customer/login" className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
            Customer Login
          </Link>
          <Link href="/driver/login" className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Driver Login
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {trustPoints.map((point) => (
            <p key={point} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
              {point}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold text-slate-900">Featured Services</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featuredServices.map((service) => (
            <ServiceCard key={service.title} {...service} />
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-3xl font-bold text-slate-900">Why Choose NI Taxi Co</h2>
          <ul className="mt-4 space-y-3 text-slate-700">
            <li>Local Northern Ireland knowledge with practical, route-aware planning.</li>
            <li>Reliable pre-booked transfers with clear confirmation and communication.</li>
            <li>Airport meet-and-greet wording available for inbound visitors.</li>
            <li>Ideal for visitors, golf groups, and operator-managed itineraries.</li>
            <li>Professional communication suitable for US and international partners.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-3xl font-bold text-slate-900">Popular Routes</h2>
          <ul className="mt-4 space-y-3 text-slate-700">
            {popularRoutes.map((route) => (
              <li key={route}>{route}</li>
            ))}
          </ul>
        </article>
      </section>

      <CTASection
        title="Plan Your Transfer with Confidence"
        description="Tell us your journey details and we will prepare a tailored quote for your private transfer or tour requirement."
        ctaLabel="Request a Quote"
        ctaHref="/quote"
      />
    </div>
  );
}
