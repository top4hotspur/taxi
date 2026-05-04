import Image from "next/image";
import Link from "next/link";
import { navLinks, siteConfig } from "@/lib/siteContent";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src={siteConfig.logoPath}
              alt={`${siteConfig.name} logo`}
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <h2 className="text-lg font-semibold text-slate-900">{siteConfig.name}</h2>
          </div>
          <p className="mt-3 text-sm text-slate-600">Northern Ireland private hire / taxi booking enquiries</p>
          <p className="mt-3 text-sm text-slate-700">Email: {siteConfig.email}</p>
          <p className="mt-1 text-sm text-slate-700">Phone: {siteConfig.phone}</p>
          <p className="mt-1 text-sm text-slate-700">Registered Company Number: {siteConfig.companyNumber}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Site Links</h3>
          <ul className="mt-3 space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-slate-600 hover:text-slate-900">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/terms" className="text-sm text-slate-600 hover:text-slate-900">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/policies" className="text-sm text-slate-600 hover:text-slate-900">
                Policies
              </Link>
            </li>
            <li>
              <Link href="/admin" className="text-sm text-slate-600 hover:text-slate-900">
                Admin Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Disclaimer</h3>
          <p className="mt-3 text-sm text-slate-600">All journeys must be pre-booked.</p>
        </div>
      </div>
    </footer>
  );
}
