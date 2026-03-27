"use client";

import { useState } from "react";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TopHero from "@/components/ui/TopHero";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "Login failed");
        setLoading(false);
        return;
      }

      const redirectTo = String(j?.redirectTo || "").trim();

      if (!redirectTo) {
        setErr("Login succeeded but redirect path is missing");
        setLoading(false);
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setErr("Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-black dark:text-white transition-colors duration-500">
      <BackgroundFX />

      <div className="relative">
        <TopHero
          brand="Ekatva"
          hideCta={true}
          eyebrow="ACCESS"
          titleLine1="Login"
          titleLine2="Welcome to Ekatva"
          titleSize="small"
          subtitle="Use your Login ID and password."
          navItems={[
            { label: "About", href: "https://ekatvatechnovation.com/" },
          ]}
        />

        <section className="mx-auto max-w-6xl px-6 pb-24 pt-10">
          <div className="mx-auto max-w-md">
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Sign in</h2>
                  <p className="mt-1 text-sm text-black/55 dark:text-white/55">
                    Use your Login ID and password.
                  </p>
                </div>
                <span className="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-3 py-1 text-xs text-black/60 dark:text-white/60">
                  Secure
                </span>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">Login ID</label>
                  <input
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="e.g. admin or ekatva_admin"
                    autoComplete="username"
                    className="mt-2 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 outline-none placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-black/20 dark:focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">Password</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    type="password"
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 outline-none placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-black/20 dark:focus:border-white/20"
                  />
                </div>

                {err && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !loginId.trim() || !password.trim()}
                  className="w-full rounded-2xl bg-black dark:bg-white py-3 font-semibold text-white dark:text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Login"}
                </button>
              </form>
            </div>

            <div className="mt-4 text-center text-xs text-black/45 dark:text-white/45">
              Powered by Ekatva • Industrial Monitoring
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}