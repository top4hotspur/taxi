import Link from "next/link";

interface HeroProps {
  title: string;
  subtitle: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
}

export default function Hero({ title, subtitle, primaryCta, secondaryCta }: HeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-200/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-16 shadow-2xl sm:px-10 sm:py-20">
      <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-3xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">NI Taxi Co</p>
        <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-200">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={primaryCta.href}
            className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="rounded-full border border-slate-300/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-200 hover:bg-slate-900"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
