import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | NI Taxi Co",
  description: "NI Taxi Co terms and conditions for pre-booked private hire and transfer services.",
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Terms &amp; Conditions</h1>
      <p className="text-slate-700">These terms explain how NI Taxi Co provides its transport services and what you can expect when booking with us. Please read them carefully before travelling.</p>
      <Term title="A. Please check your booking details">After booking, please check your confirmation carefully and let us know as soon as possible if anything is incorrect. It is your responsibility to ensure that the pickup location, destination, date, time, passenger details and contact details are correct.</Term>
      <Term title="B. Driver and journey information">Once your journey has been assigned, we may send you further journey details, including pickup instructions and driver contact information where available. Please keep these details accessible on the day of travel.</Term>
      <Term title="C. Airport journeys and timing">For airport drop-offs, we strongly recommend allowing plenty of time before your flight. As a general guide, passengers should aim to arrive at the airport at least 2 hours before departure unless their airline recommends longer. NI Taxi Co cannot accept responsibility for missed flights caused by traffic, road incidents, breakdowns, severe weather, or other circumstances outside our control.</Term>
      <Term title="D. Delays and missed connections">If your incoming flight or travel plans are delayed, please let us know as soon as possible. We will do our best to help, but we cannot guarantee that all delays can be accommodated without additional waiting charges or changes to the journey.</Term>
      <Term title="E. Vehicle capacity and luggage">Please make sure the number of passengers and amount of luggage provided at booking are accurate. We cannot accept responsibility if the selected vehicle is unsuitable because incorrect passenger or luggage details were supplied. For safety reasons, all luggage must be carried securely.</Term>
      <Term title="F. Animals">Animals must be agreed in advance. Where accepted, animals should be transported safely and appropriately. We may refuse carriage if this has not been agreed beforehand.</Term>
      <Term title="G. Journey routing">The exact route used may vary depending on road, traffic and operational conditions. Reasonable route requests can be considered, but the driver may need to choose the safest or most practical route on the day.</Term>
      <Term title="H. Third-party operators and vehicle changes">We may use carefully selected partner operators where appropriate. If needed, we may provide a similar or upgraded vehicle if the originally planned vehicle is unavailable.</Term>
      <Term title="I. Payment">Where payment is taken in advance, you are responsible for ensuring the payment details provided are correct. Additional charges may apply for agreed extras, waiting time, tolls, parking or significant booking amendments where applicable.</Term>
      <Term title="J. Damage / cleaning">Passengers may be charged for damage or exceptional cleaning costs caused by behaviour beyond normal wear and tear.</Term>
      <Term title="K. Travel insurance">We recommend that passengers have appropriate travel insurance where relevant.</Term>
    </section>
  );
}

function Term({ title, children }: { title: string; children: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-700">{children}</p>
    </article>
  );
}
