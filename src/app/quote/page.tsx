import type { Metadata } from "next";
import QuoteForm from "@/components/QuoteForm";

export const metadata: Metadata = {
  title: "Request a Quote",
  description: "Submit a pre-booked private hire enquiry for airport transfers, golf transport, tours, events, and corporate journeys.",
};

export default function QuotePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10">
        <h1 className="text-4xl font-bold">Request a Quote</h1>
        <p className="mt-4 max-w-3xl text-slate-200">
          Share your journey details and NI Taxi Co will respond with a tailored quote for your pre-booked private hire request.
        </p>
      </section>
      <QuoteForm />
    </div>
  );
}
