"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
// import { ThemeToggle } from "./ThemeToggle";
import Image from "next/image";

type TopHeroProps = {
  brand?: string;
  showMenu?: boolean;
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
  showMenu = true,
  eyebrow = "INDUSTRIAL MONITORING DASHBOARD",
  titleLine1 = "Tank",
  titleLine2 = "Control",
  subtitle = "Real-time liquid levels with smooth animations and role-based control.",
}: TopHeroProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logoutCompany = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <header className="relative overflow-hidden">
      
      <div className="relative mx-auto max-w-6xl px-6 pt-6 pb-14">
        {/* Navbar */}
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            {/* <div className="text-white/85 font-semibold tracking-tight">
              {brand}
            </div> */}
            <Image 
              src="/logo.png"
              alt={`${brand} Logo`}
              width={80}
              height={40}
              className="object-contain"
            />
          </Link>

          {/* Desktop Nav Links */}
          {showMenu && (
            <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
              <Link
                href={`/company/${slug}/dashboard`}
                className="hover:text-white transition"
              >
                Dashboard
              </Link>

              <Link
                href={`/company/${slug}/setup`}
                className="hover:text-white transition"
              >
                Setup
              </Link>

              <Link
                href="https://ekatvatechnovation.com"
                className="hover:text-white transition"
              >
                About Us
              </Link>
            </nav>
          )}

          {/* Right Section: Theme Toggle, Logout & Hamburger */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            {/* <ThemeToggle /> */}

            {/* Logout Button */}
            {showMenu && (
              <button
                onClick={logoutCompany}
                className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-black hover:bg-white transition shadow"
              >
                Logout
              </button>
            )}

            {/* Mobile Hamburger */}
            {showMenu && (
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 p-3 text-white/90 hover:bg-white/10 transition"
                onClick={() => setOpen((v) => !v)}
              >
                <HamburgerIcon open={open} />
              </button>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <div className="mt-16 md:mt-20 text-center">
          <div className="text-[10px] md:text-xs uppercase tracking-[0.28em] text-white/55">
            {eyebrow}
          </div>

          <h1 className="mt-5 leading-[0.9]">
            <span className="block text-6xl md:text-7xl font-semibold text-white">
              {titleLine1}
            </span>
            <span className="block text-6xl md:text-7xl font-semibold text-white/55">
              {titleLine2}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-sm md:text-base text-white/60">
            {subtitle}
          </p>
        </div>

      </div>

      {/* Mobile Menu */}
      {showMenu && (
        <div
          className={`fixed inset-0 z-[80] md:hidden ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >

          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0"
            } bg-blue-500/20 backdrop-blur-xl`}
            onClick={() => setOpen(false)}
          />

          <div
            className={`absolute inset-y-0 right-0 w-full
            bg-white/10 backdrop-blur-3xl
            border-l border-white/20
            shadow-[-20px_0_60px_rgba(0,0,0,0.35)]
            transition-transform duration-400
            ${open ? "translate-x-0" : "translate-x-full"}`}
          >

            {/* Mobile Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div className="text-white font-semibold text-lg">
                {brand}
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>

            {/* Mobile Menu Items */}
            <div className="px-6 pt-10 flex flex-col gap-5 text-lg">
              <Link
                href={`/company/${slug}/dashboard`}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 pb-3 text-white/90"
              >
                Dashboard
              </Link>

              <Link
                href={`/company/${slug}/setup`}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 pb-3 text-white/90"
              >
                Setup
              </Link>

              <Link
                href="https://ekatv.com"
                onClick={() => setOpen(false)}
                className="border-b border-white/10 pb-3 text-white/90"
              >
                About Us
              </Link>

              {/* Theme Toggle in Mobile Menu
              <div className="border-b border-white/10 pb-3 pt-2">
                <ThemeToggle />
              </div> */}

              {/* Logout Button */}
              <button
                onClick={logoutCompany}
                className="mt-8 rounded-2xl bg-white text-black py-4 text-center font-semibold"
              >
                Logout
              </button>
            </div>

          </div>

        </div>
      )}

    </header>
  );
}