"use client";

import * as React from "react";
import Link from "next/link";

type TopHeroProps = {
  brand?: string;
  navItems?: { label: string; href: string }[];
  ctaLabel?: string;
  onCtaClickHref?: string;
  eyebrow?: string;
  titleLine1?: string;
  titleLine2?: string;
  subtitle?: string;
};

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-5 w-6">
      <span
        className={[
          "absolute left-0 top-0 h-[2px] w-6 rounded bg-white transition",
          open ? "translate-y-[9px] rotate-45" : "",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-[9px] h-[2px] w-6 rounded bg-white transition",
          open ? "opacity-0" : "opacity-100",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-[18px] h-[2px] w-6 rounded bg-white transition",
          open ? "-translate-y-[9px] -rotate-45" : "",
        ].join(" ")}
      />
    </span>
  );
}

export default function TopHero({
  brand = "Tankco.",
  navItems = [
    { label: "About", href: "#" },
    { label: "Tanks", href: "#tanks" },
    { label: "Process", href: "#" },
    { label: "FAQ", href: "#" },
  ],
  ctaLabel = "Admin",
  onCtaClickHref = "/login",
  eyebrow = "INDUSTRIAL MONITORING DASHBOARD",
  titleLine1 = "Tank",
  titleLine2 = "Control",
  subtitle = "Real-time liquid levels with smooth animations and role-based control.",
}: TopHeroProps) {
  const [open, setOpen] = React.useState(false);

  // Lock body scroll when menu is open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes menu
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNavClick = () => setOpen(false);

  return (
    <header className="relative overflow-hidden">
      {/* Top content */}
      <div className="relative mx-auto max-w-6xl px-6 pt-6 pb-14">
        {/* Navbar */}
        <div className="flex items-center justify-between">
          <div className="text-white/85 font-semibold tracking-tight">
            {brand}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="hover:text-white transition"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Desktop CTA */}
            <Link
              href={onCtaClickHref}
              className="hidden md:inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-black
                         hover:bg-white transition shadow"
            >
              {ctaLabel}
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5
                         p-3 text-white/90 hover:bg-white/10 transition"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <HamburgerIcon open={open} />
            </button>
          </div>
        </div>

        {/* Hero center */}
        <div className="mt-16 md:mt-20 text-center">
          <div className="text-[10px] md:text-xs uppercase tracking-[0.28em] text-white/55">
            {eyebrow}
          </div>

          <h1 className="mt-5 leading-[0.9]">
            <span className="block text-6xl md:text-8xl font-semibold text-white">
              {titleLine1}
            </span>
            <span className="block text-6xl md:text-8xl font-semibold text-white/55">
              {titleLine2}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-sm md:text-base text-white/60">
            {subtitle}
          </p>

          <a
            href="#tanks"
            className="inline-flex items-center justify-center mt-8
                       rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs text-white/80
                       hover:bg-white/10 transition"
          >
            View tanks
          </a>
        </div>
      </div>

      {/* ========= iOS STYLE FULLSCREEN MOBILE MENU ========= */}
<div
  className={[
    "fixed inset-0 z-[80] md:hidden",
    open ? "pointer-events-auto" : "pointer-events-none",
  ].join(" ")}
>
  {/* Blue glass backdrop */}
  <div
    className={[
      "absolute inset-0 transition-opacity duration-300",
      open ? "opacity-100" : "opacity-0",
      "bg-blue-500/20 backdrop-blur-xl",
    ].join(" ")}
    onClick={() => setOpen(false)}
  />

  {/* Sliding panel */}
  <div
  className={[
    "absolute inset-y-0 right-0 w-full",
    // GLASS PANEL
    "bg-white/10 backdrop-blur-3xl",
    "border-l border-white/20",
    "shadow-[-20px_0_60px_rgba(0,0,0,0.35)]",
    "transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
    open ? "translate-x-0" : "translate-x-full",
  ].join(" ")}
  role="dialog"
  aria-modal="true"
>

    {/* Header */}
    <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
      <div className="text-white font-semibold text-lg">{brand}</div>
      <button
        onClick={() => setOpen(false)}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2
                   text-sm text-white hover:bg-white/10 transition"
      >
        Close
      </button>
    </div>

    {/* Menu content */}
    <div className="px-6 pt-10">
      <nav className="flex flex-col gap-5 text-lg">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between
                       border-b border-white/10 pb-3
                       text-white/90 hover:text-white transition"
          >
            {item.label}
            <span className="text-white/40">›</span>
          </a>
        ))}
      </nav>

      {/* CTA */}
      <div className="mt-12">
        <a
          href={onCtaClickHref}
          onClick={() => setOpen(false)}
          className="flex w-full items-center justify-center
                     rounded-2xl bg-white text-black
                     py-4 text-base font-semibold
                     hover:bg-white/90 transition"
        >
          {ctaLabel}
        </a>
      </div>

      {/* Hint */}
      <p className="mt-8 text-center text-xs text-white/50">
        Swipe back or tap outside to close
      </p>
    </div>
  </div>
</div>
{/* ========= END iOS MENU ========= */}

    
    </header>
  );
}
