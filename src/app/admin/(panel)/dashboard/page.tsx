"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TopHero from "@/components/ui/TopHero";
import PasswordInput from "@/components/ui/PasswordInput";

type DataMode = "generated" | "csv" | "disabled";

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  companyLoginId: string;
  tanksCount: number;
  dataMode: DataMode;
  pwd_reset_requested?: boolean;
  pwd_reset_approved?: boolean;
};

export default function AdminDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tempApproved, setTempApproved] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [companyLoginId, setCompanyLoginId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setErr("");
      setLoadingList(true);
    }

    try {
      const res = await fetch(`/api/admin/companies?t=${Date.now()}`, {
        cache: "no-store",
      });
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
      if (!silent) {
        setLoadingList(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (err) {
      const timer = setTimeout(() => setErr(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [err]);

  useVisibilityPolling(() => load(true), 8000);

  async function addCompany(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErr("");
    const cleanName = name.trim();
    const cleanLoginId = companyLoginId.trim();
    const cleanLogoUrl = logoUrl.trim();

    setShowValidation(true);
    if (!cleanName || !cleanLoginId || !password || password !== confirmPassword) {
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
          password: password,
        }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "Failed to create company");
        return;
      }

      setName("");
      setCompanyLoginId("");
      setLogoUrl("");
      setPassword("");
      setConfirmPassword("");
      setShowValidation(false);
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

  const setMode = useCallback(async (companyId: string, dataMode: DataMode) => {
    setErr("");
    
    // Optimistic Update
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, dataMode } : c));

    try {
      const res = await fetch("/api/admin/company-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, dataMode }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to update mode");
        await load(true); // Rollback/Sync
        return;
      }
    } catch {
      setErr("Failed to update mode");
      await load(true); // Rollback/Sync
    }
  }, [load]);

  const approveReset = useCallback(async (companyId: string) => {
    setErr("");
    setLoading(true);

    // Optimistic Update
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, pwd_reset_approved: true } : c));

    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pwd_reset_approved: true }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to approve reset");
        await load(true); // Sync back
        return;
      }

      setTempApproved((prev) => [...prev, companyId]);
      setTimeout(() => {
        setTempApproved((prev) => prev.filter((id) => id !== companyId));
      }, 3000);
    } catch {
      setErr("Failed to approve reset");
      await load(true); // Sync back
    } finally {
      setLoading(false);
    }
  }, [load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-black dark:text-white transition-colors duration-500">
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
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/20 bg-white/10 dark:bg-black/40 p-6 shadow-2xl backdrop-blur-2xl lg:col-span-1">
              <h2 className="text-lg font-semibold">Create Company</h2>
              <p className="mt-1 text-sm text-black/55 dark:text-white/55">
                Admin must manually enter the password.
              </p>

              <form onSubmit={addCompany} className="mt-6 space-y-3">
                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">Company name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ekatva Tech"
                    className="mt-2 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 backdrop-blur-md px-4 py-3 outline-none placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-black/20 dark:focus:border-white/20 text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Company Login ID (unique)
                  </label>
                  <input
                    value={companyLoginId}
                    onChange={(e) => setCompanyLoginId(e.target.value)}
                    placeholder="e.g. ekatva_admin"
                    className="mt-2 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 backdrop-blur-md px-4 py-3 outline-none placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-black/20 dark:focus:border-white/20 text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Logo Upload (Max 1 MB)
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="group relative flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1048576) {
                              setErr("Logo file size must be less than 1 MB");
                              e.target.value = "";
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (rev) => setLogoUrl(rev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      />
                      <div className="flex w-full items-center justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 backdrop-blur-md px-4 py-3 text-sm text-black/60 dark:text-white/60 transition-colors group-hover:border-black/20 dark:group-hover:border-white/20">
                        <span className="truncate">{logoUrl ? "File selected" : "Choose logo..."}</span>
                        <svg className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0l-4 4m4-4l4 4" />
                        </svg>
                      </div>
                    </div>
                    {logoUrl && (
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shadow-lg">
                        <img src={logoUrl} alt="Preview" className="h-full w-full object-contain p-1" />
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/preview:opacity-100 transition-opacity hover:opacity-100"
                        >
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">Password</label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter Password"
                    autoComplete="new-password"
                    className="mt-2"
                  />
                  {showValidation && !password && (
                    <p className="mt-1 px-1 text-xs text-red-500">Password is required</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-black/60 dark:text-white/60">Confirm Password</label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Confirm Password"
                    autoComplete="new-password"
                    className="mt-2"
                  />
                  {showValidation && !confirmPassword && (
                    <p className="mt-1 px-1 text-xs text-red-500">Confirm Password is required</p>
                  )}
                  {showValidation && confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 px-1 text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || (showValidation && (!name.trim() || !companyLoginId.trim() || !password || password !== confirmPassword))}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/20 dark:bg-white/10 py-3 font-bold text-black dark:text-white backdrop-blur-md hover:bg-white/30 dark:hover:bg-white/20 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Creating…" : "Create"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Companies</h2>
                  <p className="mt-1 text-sm text-black/55 dark:text-white/55">
                    Manage tenants and their data mode.
                  </p>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {loadingList ? "Loading…" : `${companies.length} total`}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt={c.name}
                          className="h-9 w-24 shrink-0 rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 object-contain"
                        />
                      ) : (
                        <div className="grid h-9 w-24 shrink-0 place-items-center rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-[10px] text-black/60 dark:text-white/60">
                          NO LOGO
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-black/55 dark:text-white/55 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="whitespace-nowrap">
                            Login ID: <span className="text-black/80 dark:text-white/80">{c.companyLoginId}</span>
                          </span>
                          {c.pwd_reset_requested && !c.pwd_reset_approved && (
                            <span className="inline-flex items-center text-[9px] font-bold text-red-500 animate-pulse uppercase tracking-tight bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 whitespace-nowrap">
                              Password reset request
                            </span>
                          )}
                          <span className="mx-0.5">•</span>
                          <span>
                            Tanks: <span className="text-black/80 dark:text-white/80">{c.tanksCount ?? 0}</span>
                          </span>
                        </div>
                        <div className="truncate text-xs text-black/45 dark:text-white/45">
                          Route: <span className="text-black/70 dark:text-white/70">/company/{c.slug}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2">
                       {c.pwd_reset_requested && !c.pwd_reset_approved && (
                         <button
                           onClick={() => approveReset(c.id)}
                           disabled={loading}
                           className="mr-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"
                         >
                           Approve Reset
                         </button>
                       )}

                       {tempApproved.includes(c.id) && (
                         <div className="mr-2 flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-600">
                           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                           Approved
                         </div>
                       )}

                      <select
                        value={c.dataMode}
                        onChange={(e) =>
                          setMode(c.id, e.target.value as DataMode)
                        }
                        className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-3 py-2 text-xs text-black dark:text-white"
                        title="Data mode"
                      >
                        <option value="generated">Generated</option>
                        <option value="csv">CSV</option>
                        <option value="disabled">Disabled</option>
                      </select>

                      <Link
                        href={`/company/${c.slug}/setup`}
                        className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        Open
                      </Link>

                      <button
                        onClick={() => removeCompany(c.id)}
                        className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {!loadingList && companies.length === 0 && (
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-4 py-10 text-center text-sm text-black/55 dark:text-white/55">
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