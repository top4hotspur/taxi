"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/quotes", label: "Manage Quotes" },
  { href: "/admin/customers", label: "View Customers" },
  { href: "/admin/drivers", label: "Manage Drivers" },
  { href: "/admin/pricing", label: "Pricing Rules" },
  { href: "/admin/analytics", label: "Analytics" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max flex-wrap gap-2 px-1">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
