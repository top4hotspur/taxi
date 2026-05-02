import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policies | NI Taxi Co",
  description: "NI Taxi Co booking and service policies for cancellations, waiting time, pricing, and privacy.",
};

export default function PoliciesPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Policies</h1>
      <Policy title="A. Cancellations and refunds">Cancellations made with at least 24 hours’ notice may be eligible for a refund, less an administration charge of £7 or 10% of the booking value, whichever is greater. Cancellations made with less than 24 hours’ notice are normally non-refundable. No-shows are non-refundable. Cancellation requests must be made directly with NI Taxi Co and are only confirmed once we acknowledge them.</Policy>
      <Policy title="B. Waiting time">For airport pickups, the first hour after the flight has landed is included. After that, waiting time may be charged at the applicable rate. For non-airport pickups, waiting time may be charged from the scheduled pickup time. Any waiting charges will be explained clearly where possible.</Policy>
      <Policy title="C. Tolls and parking">Tolls, parking charges or access fees may not always be included in an estimate unless stated. Where applicable, these may be added to the journey price.</Policy>
      <Policy title="D. Amendments">Booking changes should be made through NI Taxi Co, not directly with the driver. Amendments are only confirmed once we acknowledge them.</Policy>
      <Policy title="E. Pricing">Prices are based on the journey details provided, including distance, timing, route, vehicle size and passenger numbers. Online estimates are provisional and subject to confirmation. Additional surcharges may apply at peak periods, public holidays or for specialist requirements.</Policy>
      <Policy title="F. Privacy">We use your information to manage your booking and provide our services. Where needed, we may share relevant booking information with drivers or trusted service partners involved in your journey. We do not use your information for purposes unrelated to your booking without a lawful basis.</Policy>
      <Policy title="G. Conduct">We expect passengers and staff to treat each other respectfully. We may refuse or withdraw service in cases involving threatening, abusive or unsafe behaviour.</Policy>
    </section>
  );
}

function Policy({ title, children }: { title: string; children: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-700">{children}</p>
    </article>
  );
}
