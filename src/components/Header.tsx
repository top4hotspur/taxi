"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navLinks } from "@/lib/siteContent";

const utilityLinks = [
  { label: "Login", href: "/login" },
  { label: "Account", href: "/account" },
  { label: "Admin", href: "/admin" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-xl font-semibold tracking-wide text-white">NI Taxi Co</Link>

        <button type="button" className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 md:hidden" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label="Toggle menu">Menu</button>

        <nav className="hidden items-center gap-6 md:flex">
          {[...navLinks, ...utilityLinks].map((link) => {
            const active = pathname === link.href;
            return <Link key={link.href} href={link.href} className={`text-sm font-medium transition ${active ? "text-amber-300" : "text-slate-200 hover:text-white"}`}>{link.label}</Link>;
          })}
        </nav>
      </div>

      {open && (
        <nav className="border-t border-slate-800 bg-slate-950 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3">
            {[...navLinks, ...utilityLinks].map((link) => {
              const active = pathname === link.href;
              return <Link key={link.href} href={link.href} className={`text-sm font-medium ${active ? "text-amber-300" : "text-slate-200"}`} onClick={() => setOpen(false)}>{link.label}</Link>;
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
