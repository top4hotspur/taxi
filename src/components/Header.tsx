"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const servicesLinks = [
  { label: "Airport Transfers", href: "/airport-transfers" },
  { label: "Golf Transfers", href: "/golf-transfers" },
  { label: "Tours", href: "/tours" },
];

const customerLinks = [
  { label: "Login", href: "/customer/login" },
  { label: "Register", href: "/customer/register" },
];

const driverLinks = [
  { label: "Login", href: "/driver/login" },
  { label: "Register", href: "/driver/register" },
];

function isActive(pathname: string, href: string) {
  return pathname === href;
}

function hasServicesActive(pathname: string) {
  return servicesLinks.some((link) => pathname === link.href) || pathname === "/services";
}

type DesktopDropdown = "services" | "customer" | "driver" | null;

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [activeDesktopDropdown, setActiveDesktopDropdown] = useState<DesktopDropdown>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const desktopNavRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!desktopNavRef.current) return;
      if (!desktopNavRef.current.contains(event.target as Node)) {
        setActiveDesktopDropdown(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDesktopDropdown(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggleDesktopDropdown(target: Exclude<DesktopDropdown, null>) {
    setActiveDesktopDropdown((current) => (current === target ? null : target));
  }

  function closeDesktopDropdown() {
    setActiveDesktopDropdown(null);
  }

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

        <nav ref={desktopNavRef} className="hidden items-center gap-6 md:flex">
          <div className="flex items-center gap-5">
            <Link href="/" className={`text-sm font-medium transition ${isActive(pathname, "/") ? "text-amber-300" : "text-slate-200 hover:text-white"}`}>
              Home
            </Link>
            <Link href="/quote" className={`text-sm font-medium transition ${isActive(pathname, "/quote") ? "text-amber-300" : "text-slate-200 hover:text-white"}`}>
              Request a Quote
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-expanded={activeDesktopDropdown === "services"}
                aria-haspopup="menu"
                onClick={() => toggleDesktopDropdown("services")}
                className={`text-sm font-medium transition ${hasServicesActive(pathname) || activeDesktopDropdown === "services" ? "text-amber-300" : "text-slate-200 hover:text-white"}`}
              >
                Services
              </button>
              {activeDesktopDropdown === "services" && (
                <div className="absolute left-0 top-full mt-0 min-w-52 pt-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl" role="menu" aria-label="Services menu">
                    {servicesLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDesktopDropdown}
                        className={`block rounded px-3 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-200 hover:bg-slate-900 hover:text-white"}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ml-4 flex items-center gap-4 border-l border-slate-700/70 pl-4">
            <div className="relative">
              <button
                type="button"
                aria-expanded={activeDesktopDropdown === "customer"}
                aria-haspopup="menu"
                onClick={() => toggleDesktopDropdown("customer")}
                className={`text-sm font-medium transition ${activeDesktopDropdown === "customer" ? "text-amber-300" : "text-slate-200 hover:text-white"}`}
              >
                Customer
              </button>
              {activeDesktopDropdown === "customer" && (
                <div className="absolute right-0 top-full mt-0 min-w-52 pt-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl" role="menu" aria-label="Customer menu">
                    {customerLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDesktopDropdown}
                        className={`block rounded px-3 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-200 hover:bg-slate-900 hover:text-white"}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                aria-expanded={activeDesktopDropdown === "driver"}
                aria-haspopup="menu"
                onClick={() => toggleDesktopDropdown("driver")}
                className={`text-sm font-medium transition ${activeDesktopDropdown === "driver" ? "text-amber-300" : "text-slate-200 hover:text-white"}`}
              >
                Driver
              </button>
              {activeDesktopDropdown === "driver" && (
                <div className="absolute right-0 top-full mt-0 min-w-52 pt-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl" role="menu" aria-label="Driver menu">
                    {driverLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDesktopDropdown}
                        className={`block rounded px-3 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-200 hover:bg-slate-900 hover:text-white"}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
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

            <button type="button" aria-expanded={servicesOpen} aria-haspopup="menu" onClick={() => setServicesOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
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

            <button type="button" aria-expanded={customerOpen} aria-haspopup="menu" onClick={() => setCustomerOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
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

            <button type="button" aria-expanded={driverOpen} aria-haspopup="menu" onClick={() => setDriverOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
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
