"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import PasswordInput from "@/components/ui/PasswordInput";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";

type Company = { id: string; name: string; logoUrl?: string; pwd_reset_requested?: boolean; pwd_reset_approved?: boolean };

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tempApproved, setTempApproved] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyLoginId, setCompanyLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setErr("");
    }

    try {
      const res = await fetch(`/api/admin/companies?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to load companies");
        setCompanies([]);
        return;
      }

      const j = await res.json();
      setCompanies(j.companies ?? []);
    } catch {
      setErr("Failed to load companies");
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useVisibilityPolling(() => load(true), 8000);

  useEffect(() => {
    if (err) {
      const timer = setTimeout(() => setErr(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [err]);

  async function addCompany(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErr("");

    setShowValidation(true);
    if (!name.trim() || !companyLoginId.trim() || !password || password !== confirmPassword) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          logoUrl: logoUrl.trim(),
          companyLoginId: companyLoginId.trim(),
          password: password,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to create company");
        return;
      }

      setName("");
      setLogoUrl("");
      setCompanyLoginId("");
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
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to remove company");
        return;
      }

      await load();
    } catch {
      setErr("Failed to remove company");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">Companies</h1>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Add/remove companies (sub-admin tenants).
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-full border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10"
          >
            Logout
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-black dark:text-white">Add Company</h2>

            <form onSubmit={addCompany} className="mt-3 space-y-3">
              <div className="space-y-1">
                <input
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 text-black dark:text-white outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
                  placeholder="Company name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {showValidation && !name.trim() && (
                  <p className="px-1 text-xs text-red-500">Company name is required</p>
                )}
              </div>

              <div className="space-y-1">
                <input
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 text-black dark:text-white outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
                  placeholder="Login ID (required)"
                  value={companyLoginId}
                  onChange={(e) => setCompanyLoginId(e.target.value)}
                />
                {showValidation && !companyLoginId.trim() && (
                  <p className="px-1 text-xs text-red-500">Login ID is required</p>
                )}
              </div>

              <div className="space-y-1">
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter Password"
                  autoComplete="new-password"
                />
                {showValidation && !password && (
                  <p className="px-1 text-xs text-red-500">Password is required</p>
                )}
              </div>

              <div className="space-y-1">
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                />
                {showValidation && !confirmPassword && (
                  <p className="px-1 text-xs text-red-500">Confirm Password is required</p>
                )}
                {showValidation && confirmPassword && password !== confirmPassword && (
                  <p className="px-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="px-1 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                  Logo Upload (Max 1 MB)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
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
                    <div className="flex w-full items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 text-sm text-black/60 dark:text-white/60">
                      <span className="truncate">{logoUrl ? "Change logo" : "Choose logo..."}</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0l-4 4m4-4l4 4" />
                      </svg>
                    </div>
                  </div>
                  {logoUrl && (
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                      <img src={logoUrl} alt="Preview" className="h-full w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setLogoUrl("")}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {err && <div className="text-sm text-red-600 dark:text-red-300">{err}</div>}

              <button
                type="submit"
                disabled={loading || (showValidation && (!name.trim() || !companyLoginId.trim() || !password || password !== confirmPassword))}
                className="w-full rounded-xl bg-black dark:bg-white py-3 font-semibold text-white dark:text-black disabled:cursor-not-allowed disabled:opacity-60 transition"
              >
                {loading ? "Please wait..." : "Create"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-black dark:text-white">All Companies</h2>

            <div className="mt-4 space-y-3">
              {companies.length === 0 ? (
                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-3 py-8 text-center text-sm text-black/60 dark:text-white/60">
                  No companies yet.
                </div>
              ) : (
                companies.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt={c.name}
                          className="h-7 w-20 rounded bg-black/5 dark:bg-white/5 object-contain"
                        />
                      ) : (
                        <div className="flex h-7 w-20 items-center justify-center rounded bg-black/5 dark:bg-white/5 text-[10px] text-black/70 dark:text-white/70">
                          NO LOGO
                        </div>
                      )}

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                          {c.name}
                          {c.pwd_reset_requested && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Password Reset Requested" />
                          )}
                        </div>
                        {c.pwd_reset_requested && (
                          <span className="text-[10px] font-semibold text-red-500 uppercase tracking-tighter">Reset Requested</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       {c.pwd_reset_requested && !c.pwd_reset_approved && (
                         <button
                           onClick={async () => {
                             if(!confirm(`Approve password reset request for ${c.name}?`)) return;
                             setLoading(true);
                             try {
                               const res = await fetch(`/api/admin/companies/${c.id}`, {
                                 method: "PATCH",
                                 headers: {"Content-Type": "application/json"},
                                 body: JSON.stringify({ pwd_reset_approved: true })
                               });
                               if(res.ok) {
                                 setTempApproved(prev => [...prev, c.id]);
                                 setTimeout(() => {
                                   setTempApproved(prev => prev.filter(id => id !== c.id));
                                 }, 3000);
                                 await load(true);
                               } else {
                                 alert("Failed to approve request.");
                               }
                             } catch {
                               alert("Error approving request.");
                             } finally {
                               setLoading(false);
                             }
                           }}
                           className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition"
                         >
                           Approve
                         </button>
                       )}
                       {tempApproved.includes(c.id) && (
                         <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                           Approved
                         </span>
                       )}

                      <button
                        onClick={() => removeCompany(c.id)}
                        disabled={loading}
                        className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {err && <div className="mt-3 text-sm text-red-600 dark:text-red-300">{err}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}