"use client";

import { useEffect, useState } from "react";

type Company = { id: string; name: string; logoUrl?: string };

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");

    try {
      const res = await fetch("/api/admin/companies", {
        cache: "no-store",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to load companies");
        return;
      }

      const j = await res.json();
      setCompanies(j.companies ?? []);
    } catch {
      setErr("Failed to load companies");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addCompany() {
    setErr("");

    if (!name.trim()) {
      setErr("Company name is required");
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
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ?? "Failed to create company");
        return;
      }

      setName("");
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

            <div className="mt-3 space-y-3">
              <input
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 text-black dark:text-white outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
                placeholder="Company name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 px-4 py-3 text-black dark:text-white outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
                placeholder="Logo URL (optional)"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />

              {err && <div className="text-sm text-red-600 dark:text-red-300">{err}</div>}

              <button
                onClick={addCompany}
                disabled={loading}
                className="w-full rounded-xl bg-black dark:bg-white py-3 font-semibold text-white dark:text-black disabled:cursor-not-allowed disabled:opacity-60 transition"
              >
                {loading ? "Please wait..." : "Add"}
              </button>
            </div>
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

                      <div className="text-sm font-medium text-black dark:text-white">
                        {c.name}
                      </div>
                    </div>

                    <button
                      onClick={() => removeCompany(c.id)}
                      disabled={loading}
                      className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
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