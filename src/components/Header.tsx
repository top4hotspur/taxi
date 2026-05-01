"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const servicesLinks = [
  { label: "Airport Transfers", href: "/airport-transfers" },
  { label: "Golf Transfers", href: "/golf-transfers" },
  { label: "Tours", href: "/tours" },
];

const customerLinks = [
  { label: "Customer Login", href: "/customer/login" },
  { label: "Customer Register", href: "/customer/register" },
];

const driverLinks = [
  { label: "Driver Login", href: "/driver/login" },
  { label: "Driver Register", href: "/driver/register" },
];

function isActive(pathname: string, href: string) {
  return pathname === href;
}

function hasServicesActive(pathname: string) {
  return servicesLinks.some((link) => pathname === link.href) || pathname === "/services";
}

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { isAdmin?: boolean };
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-xl font-semibold tracking-wide text-white">
          NI Taxi Co
        </Link>

        <button
          type="button"
          className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 md:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          Menu
        </button>

        <nav className="hidden items-center gap-6 md:flex">
          <div className="flex items-center gap-5">
            <Link href="/" className={`text-sm font-medium transition ${isActive(pathname, "/") ? "text-amber-300" : "text-slate-200 hover:text-white"}`}>
              Home
            </Link>
            <Link href="/quote" className={`text-sm font-medium transition ${isActive(pathname, "/quote") ? "text-amber-300" : "text-slate-200 hover:text-white"}`}>
              Request a Quote
            </Link>
            <div className="group relative">
              <button type="button" className={`text-sm font-medium transition ${hasServicesActive(pathname) ? "text-amber-300" : "text-slate-200 group-hover:text-white"}`}>
                Services
              </button>
              <div className="invisible absolute left-0 top-full mt-2 min-w-52 rounded-lg border border-slate-700 bg-slate-950 p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                {servicesLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block rounded px-3 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-200 hover:bg-slate-900 hover:text-white"}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="ml-4 flex items-center gap-4 border-l border-slate-700/70 pl-4">
            <div className="group relative">
              <button type="button" className="text-sm font-medium text-slate-200 transition group-hover:text-white">
                Customer
              </button>
              <div className="invisible absolute right-0 top-full mt-2 min-w-52 rounded-lg border border-slate-700 bg-slate-950 p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                {customerLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`block rounded px-3 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-200 hover:bg-slate-900 hover:text-white"}`}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative">
              <button type="button" className="text-sm font-medium text-slate-200 transition group-hover:text-white">
                Driver
              </button>
              <div className="invisible absolute right-0 top-full mt-2 min-w-52 rounded-lg border border-slate-700 bg-slate-950 p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                {driverLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`block rounded px-3 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-200 hover:bg-slate-900 hover:text-white"}`}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            {isAdmin && (
              <Link href="/admin" className={`text-sm font-medium transition ${isActive(pathname, "/admin") ? "text-amber-300" : "text-slate-200 hover:text-white"}`}>
                Admin
              </Link>
            )}
          </div>
        </nav>
      </div>

      {open && (
        <nav className="border-t border-slate-800 bg-slate-950 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            <Link href="/" className={`rounded px-2 py-2 text-sm font-medium ${isActive(pathname, "/") ? "bg-slate-800 text-amber-300" : "text-slate-200"}`} onClick={() => setOpen(false)}>
              Home
            </Link>
            <Link href="/quote" className={`rounded px-2 py-2 text-sm font-medium ${isActive(pathname, "/quote") ? "bg-slate-800 text-amber-300" : "text-slate-200"}`} onClick={() => setOpen(false)}>
              Request a Quote
            </Link>

            <button type="button" onClick={() => setServicesOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
              Services
            </button>
            {servicesOpen && (
              <div className="ml-3 flex flex-col">
                {servicesLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`rounded px-2 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-300"}`} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <button type="button" onClick={() => setCustomerOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
              Customer
            </button>
            {customerOpen && (
              <div className="ml-3 flex flex-col">
                {customerLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`rounded px-2 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-300"}`} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <button type="button" onClick={() => setDriverOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
              Driver
            </button>
            {driverOpen && (
              <div className="ml-3 flex flex-col">
                {driverLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`rounded px-2 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-300"}`} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {isAdmin && (
              <Link href="/admin" className={`rounded px-2 py-2 text-sm font-medium ${isActive(pathname, "/admin") ? "bg-slate-800 text-amber-300" : "text-slate-200"}`} onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
