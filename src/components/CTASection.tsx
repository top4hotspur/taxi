import Link from "next/link";

interface CTASectionProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export default function CTASection({ title, description, ctaLabel, ctaHref }: CTASectionProps) {
  return (
    <section className="rounded-3xl bg-slate-950 px-6 py-12 text-center text-white sm:px-10">
      <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-slate-300">{description}</p>
      <Link
        href={ctaHref}
        className="mt-8 inline-block rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
