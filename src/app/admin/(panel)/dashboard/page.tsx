"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TopHero from "@/components/ui/TopHero";

type DataMode = "generated" | "csv" | "disabled";

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  companyLoginId: string;
  tanksCount: number;
  dataMode: DataMode;
};

export default function AdminDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [companyLoginId, setCompanyLoginId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [createdCredentials, setCreatedCredentials] = useState<{
    loginId: string;
    password: string;
  } | null>(null);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  async function load() {
    setErr("");
    setLoadingList(true);

    try {
      const res = await fetch("/api/admin/companies", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(j?.error ?? "Failed to load companies");
        setCompanies([]);
        return;
      }

      setCompanies(Array.isArray(j?.companies) ? j.companies : []);
    } catch {
      setErr("Failed to load companies");
      setCompanies([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addCompany() {
    setErr("");
    setCreatedCredentials(null);

    const cleanName = name.trim();
    const cleanLoginId = companyLoginId.trim();
    const cleanLogoUrl = logoUrl.trim();

    if (!cleanName) {
      setErr("Company name is required");
      return;
    }

    if (!cleanLoginId) {
      setErr("Company Login ID is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          companyLoginId: cleanLoginId,
          logoUrl: cleanLogoUrl,
        }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "Failed to create company");
        return;
      }

      setCreatedCredentials({
        loginId: j?.credentials?.loginId ?? "",
        password: j?.credentials?.password ?? "",
      });

      setName("");
      setCompanyLoginId("");
      setLogoUrl("");
      await load();
    } catch {
      setErr("Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  async function removeCompany(id: string) {
    setErr("");

    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "DELETE",
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(j?.error ?? "Failed to delete");
        return;
      }

      await load();
    } catch {
      setErr("Failed to delete");
    }
  }

  async function setMode(companyId: string, dataMode: DataMode) {
    setErr("");

    try {
      const res = await fetch("/api/admin/company-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, dataMode }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(j?.error ?? "Failed to update mode");
        return;
      }

      await load();
    } catch {
      setErr("Failed to update mode");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <BackgroundFX />

      <div className="relative">
        <TopHero
          brand="Tankco."
          ctaLabel="Logout"
          onCtaClickHref="/login"
          eyebrow="ADMIN PANEL"
          titleLine1="Company"
          titleLine2="Management"
          subtitle="Create companies, issue temporary credentials, and control data mode."
          navItems={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Companies", href: "#companies" },
          ]}
        />

        <section id="companies" className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          {err && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-1">
              <h2 className="text-lg font-semibold">Create Company</h2>
              <p className="mt-1 text-sm text-white/55">
                Generate a company login ID + temporary password.
              </p>

              <div className="mt-6 space-y-3">
                <div>
                  <label className="text-xs text-white/60">Company name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ekatva Tech"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-white/25 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">
                    Company Login ID (unique)
                  </label>
                  <input
                    value={companyLoginId}
                    onChange={(e) => setCompanyLoginId(e.target.value)}
                    placeholder="e.g. ekatva_admin"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-white/25 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">
                    Logo URL (optional)
                  </label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-white/25 focus:border-white/20"
                  />
                </div>

                <button
                  disabled={loading || !name.trim() || !companyLoginId.trim()}
                  onClick={addCompany}
                  className="mt-2 w-full rounded-2xl bg-white py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating…" : "Create"}
                </button>

                {createdCredentials && (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                    <div className="text-xs text-emerald-200/80">
                      Company credentials
                    </div>

                    <div className="mt-3 text-xs text-emerald-200/70">
                      Login ID
                    </div>
                    <div className="mt-1 font-mono text-sm text-emerald-100">
                      {createdCredentials.loginId}
                    </div>

                    <div className="mt-3 text-xs text-emerald-200/70">
                      Temporary password
                    </div>
                    <div className="mt-1 font-mono text-sm text-emerald-100">
                      {createdCredentials.password}
                    </div>

                    <div className="mt-2 text-xs text-emerald-200/60">
                      Copy now and share with the company. It won’t be shown again.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Companies</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Manage tenants and their data mode.
                  </p>
                </div>
                <div className="text-xs text-white/50">
                  {loadingList ? "Loading…" : `${companies.length} total`}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt={c.name}
                          className="h-9 w-24 rounded border border-white/10 bg-white/5 object-contain"
                        />
                      ) : (
                        <div className="grid h-9 w-24 place-items-center rounded border border-white/10 bg-white/5 text-[10px] text-white/60">
                          NO LOGO
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {c.name}
                        </div>

                        <div className="truncate text-xs text-white/55">
                          Login ID:{" "}
                          <span className="text-white/80">
                            {c.companyLoginId}
                          </span>
                          <span className="mx-2">•</span>
                          Tanks:{" "}
                          <span className="text-white/80">
                            {c.tanksCount ?? 0}
                          </span>
                        </div>

                        <div className="truncate text-xs text-white/45">
                          Route:{" "}
                          <span className="text-white/70">
                            /company/{c.slug}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={c.dataMode}
                        onChange={(e) =>
                          setMode(c.id, e.target.value as DataMode)
                        }
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
                        title="Data mode"
                      >
                        <option value="generated">Generated</option>
                        <option value="csv">CSV</option>
                        <option value="disabled">Disabled</option>
                      </select>

                      <Link
                        href={`/company/${c.slug}/setup`}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
                      >
                        Open
                      </Link>

                      <button
                        onClick={() => removeCompany(c.id)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {!loadingList && companies.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/55">
                    No companies created yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}