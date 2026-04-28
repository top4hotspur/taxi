import Link from "next/link";

interface ServiceCardProps {
  title: string;
  description: string;
  href?: string;
}

export default function ServiceCard({ title, description, href }: ServiceCardProps) {
  return (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
      {href && (
        <Link href={href} className="mt-5 inline-block text-sm font-semibold text-slate-900 hover:text-amber-600">
          {"Learn more ->"}
        </Link>
      )}
    </article>
  );
}

