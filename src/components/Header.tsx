"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/siteContent";

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
  const [openMenu, setOpenMenu] = useState<null | "services" | "customer" | "driver">(null);
  const desktopNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!desktopNavRef.current) return;
      if (!desktopNavRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggleMenu(target: "services" | "customer" | "driver") {
    setOpenMenu((current) => (current === target ? null : target));
  }

  function closeDesktopMenu() {
    setOpenMenu(null);
  }

  function closeMobileMenu() {
    setOpen(false);
    setServicesOpen(false);
    setCustomerOpen(false);
    setDriverOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 text-white"
          onClick={closeMobileMenu}
          aria-label={siteConfig.name}
        >
          <Image
            src={siteConfig.logoPath}
            alt={`${siteConfig.name} logo`}
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-lg font-semibold tracking-wide sm:text-xl">{siteConfig.name}</span>
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
            <Link href="/" className={`text-sm font-medium transition ${isActive(pathname, "/") ? "text-amber-300" : "text-slate-200 hover:text-white"}`} onClick={closeDesktopMenu}>
              Home
            </Link>
            <Link href="/quote" className={`text-sm font-medium transition ${isActive(pathname, "/quote") ? "text-amber-300" : "text-slate-200 hover:text-white"}`} onClick={closeDesktopMenu}>
              Request a Quote
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-expanded={openMenu === "services"}
                aria-haspopup="menu"
                onClick={() => toggleMenu("services")}
                className={`inline-flex items-center gap-1 text-sm font-medium transition ${hasServicesActive(pathname) || openMenu === "services" ? "text-amber-300" : "text-slate-200 hover:text-white"}`}
              >
                Services
                <span aria-hidden="true" className="text-xs">v</span>
              </button>
              {openMenu === "services" && (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-52">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl" role="menu" aria-label="Services menu">
                    {servicesLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDesktopMenu}
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
                aria-expanded={openMenu === "customer"}
                aria-haspopup="menu"
                onClick={() => toggleMenu("customer")}
                className={`inline-flex items-center gap-1 text-sm font-medium transition ${openMenu === "customer" ? "text-amber-300" : "text-slate-200 hover:text-white"}`}
              >
                Customer
                <span aria-hidden="true" className="text-xs">v</span>
              </button>
              {openMenu === "customer" && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-52">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl" role="menu" aria-label="Customer menu">
                    {customerLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDesktopMenu}
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
                aria-expanded={openMenu === "driver"}
                aria-haspopup="menu"
                onClick={() => toggleMenu("driver")}
                className={`inline-flex items-center gap-1 text-sm font-medium transition ${openMenu === "driver" ? "text-amber-300" : "text-slate-200 hover:text-white"}`}
              >
                Driver
                <span aria-hidden="true" className="text-xs">v</span>
              </button>
              {openMenu === "driver" && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-52">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl" role="menu" aria-label="Driver menu">
                    {driverLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDesktopMenu}
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
        </nav>
      </div>

      {open && (
        <nav className="border-t border-slate-800 bg-slate-950 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            <Link href="/" className={`rounded px-2 py-2 text-sm font-medium ${isActive(pathname, "/") ? "bg-slate-800 text-amber-300" : "text-slate-200"}`} onClick={closeMobileMenu}>
              Home
            </Link>
            <Link href="/quote" className={`rounded px-2 py-2 text-sm font-medium ${isActive(pathname, "/quote") ? "bg-slate-800 text-amber-300" : "text-slate-200"}`} onClick={closeMobileMenu}>
              Request a Quote
            </Link>

            <button type="button" aria-expanded={servicesOpen} aria-haspopup="menu" onClick={() => setServicesOpen((current) => !current)} className="rounded px-2 py-2 text-left text-sm font-medium text-slate-200">
              Services
            </button>
            {servicesOpen && (
              <div className="ml-3 flex flex-col">
                {servicesLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`rounded px-2 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-300"}`} onClick={closeMobileMenu}>
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
                  <Link key={link.href} href={link.href} className={`rounded px-2 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-300"}`} onClick={closeMobileMenu}>
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
                  <Link key={link.href} href={link.href} className={`rounded px-2 py-2 text-sm ${isActive(pathname, link.href) ? "bg-slate-800 text-amber-300" : "text-slate-300"}`} onClick={closeMobileMenu}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

          </div>
        </nav>
      )}
    </header>
  );
}
