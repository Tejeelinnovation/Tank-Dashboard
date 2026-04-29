"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TopHero from "@/components/ui/TopHero";
import PasswordInput from "@/components/ui/PasswordInput";

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  companyLoginId: string;
  tanksCount: number;
  influxOrg?: string;
  influxBucket?: string;
  pwd_reset_requested?: boolean;
  pwd_reset_approved?: boolean;
};

type InfluxOrg = { id: string; name: string };
type InfluxBucket = { id: string; name: string };

export default function AdminDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tempApproved, setTempApproved] = useState<string[]>([]);
  
  // Create Form State
  const [name, setName] = useState("");
  const [companyLoginId, setCompanyLoginId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedBucket, setSelectedBucket] = useState("");
  
  // Discovery State
  const [availableOrgs, setAvailableOrgs] = useState<InfluxOrg[]>([]);
  const [availableBuckets, setAvailableBuckets] = useState<InfluxBucket[]>([]);
  const [availableEditBuckets, setAvailableEditBuckets] = useState<InfluxBucket[]>([]);

  // Edit State
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoginId, setEditLoginId] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editBucket, setEditBucket] = useState("");
  const [editTanksCount, setEditTanksCount] = useState(1);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [showValidation, setShowValidation] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setErr("");
      setLoadingList(true);
    }

    try {
      const res = await fetch(`/api/admin/companies?t=${Date.now()}`, { cache: "no-store" });
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
      if (!silent) setLoadingList(false);
    }
  }, []);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/influx/discovery?type=orgs");
      const j = await res.json();
      if (res.ok) setAvailableOrgs(j.orgs || []);
    } catch (e) { console.error("Org fetch failed", e); }
  }, []);

  const fetchBuckets = async (orgId: string, isEdit = false) => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/admin/influx/discovery?type=buckets&orgId=${orgId}`);
      const j = await res.json();
      if (res.ok) {
        if (isEdit) setAvailableEditBuckets(j.buckets || []);
        else setAvailableBuckets(j.buckets || []);
      }
    } catch (e) { console.error("Bucket fetch failed", e); }
  };

  useEffect(() => {
    console.log("Admin Dashboard Loaded - V2 (Dynamic Influx)");
    load();
    fetchOrgs();
  }, [load, fetchOrgs]);

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
    setShowValidation(true);
    if (!name.trim() || !companyLoginId.trim() || !password || password !== confirmPassword || !selectedOrg || !selectedBucket) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyLoginId: companyLoginId.trim(),
          logoUrl: logoUrl.trim(),
          password,
          influxOrg: selectedOrg,
          influxBucket: selectedBucket,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "Failed to create company");
        return;
      }

      setName(""); setCompanyLoginId(""); setLogoUrl(""); setPassword(""); setConfirmPassword(""); setSelectedOrg(""); setSelectedBucket("");
      setShowValidation(false);
      await load();
    } catch {
      setErr("Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  async function removeCompany(id: string) {
    if (!confirm("Are you sure you want to delete this company?")) return;
    setErr("");
    try {
      const res = await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
      if (!res.ok) { setErr("Failed to delete"); return; }
      await load();
    } catch { setErr("Failed to delete"); }
  }

  const startEdit = (c: Company) => {
    setEditingCompany(c);
    setEditName(c.name);
    setEditLoginId(c.companyLoginId);
    setEditLogoUrl(c.logoUrl || "");
    setEditOrg(c.influxOrg || "");
    setEditBucket(c.influxBucket || "");
    setEditTanksCount(c.tanksCount);
    if (c.influxOrg) fetchBuckets(c.influxOrg, true);
  };

  const saveEdit = async () => {
    if (!editingCompany) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${editingCompany.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          companyLoginId: editLoginId.trim(),
          logoUrl: editLogoUrl.trim(),
          influxOrg: editOrg,
          influxBucket: editBucket,
          tanksCount: editTanksCount,
        }),
      });
      if (res.ok) {
        setEditingCompany(null);
        await load();
      } else {
        const j = await res.json();
        setErr(j?.error || "Failed to update");
      }
    } catch { setErr("Error updating company"); }
    finally { setLoading(false); }
  };

  const approveReset = useCallback(async (companyId: string) => {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pwd_reset_approved: true }),
      });
      if (!res.ok) { setErr("Failed to approve reset"); return; }
      setTempApproved((prev) => [...prev, companyId]);
      setTimeout(() => setTempApproved((prev) => prev.filter((id) => id !== companyId)), 3000);
      await load(true);
    } catch { setErr("Failed to approve reset"); }
    finally { setLoading(false); }
  }, [load]);

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
          subtitle="Create companies, select InfluxDB data sources, and manage tenants."
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
            {/* Create Company */}
            <div className="rounded-3xl border border-white/20 bg-white/10 dark:bg-black/40 p-6 shadow-2xl backdrop-blur-2xl lg:col-span-1">
              <h2 className="text-lg font-semibold">Create Company</h2>
              <p className="mt-1 text-sm text-black/55 dark:text-white/55">Enter company details and data source.</p>

              <form onSubmit={addCompany} className="mt-6 space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company Name" className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 px-4 py-3 outline-none" />
                <input value={companyLoginId} onChange={(e) => setCompanyLoginId(e.target.value)} placeholder="Login ID" className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 px-4 py-3 outline-none" />
                
                <div className="space-y-2 pt-2">
                  <div className="text-[10px] font-bold uppercase opacity-40 px-1">Influx Data Source</div>
                  <select value={selectedOrg} onChange={(e) => { setSelectedOrg(e.target.value); setSelectedBucket(""); fetchBuckets(e.target.value); }} className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 px-3 py-2 text-sm outline-none">
                    <option value="">Select Influx Org</option>
                    {availableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select disabled={!selectedOrg} value={selectedBucket} onChange={(e) => setSelectedBucket(e.target.value)} className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 px-3 py-2 text-sm outline-none disabled:opacity-40">
                    <option value="">Select Influx Bucket</option>
                    {availableBuckets.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>

                <div className="pt-2">
                  <label className="text-xs text-black/60 dark:text-white/60">Logo</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input type="file" accept="image/*" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if(f){ const r=new FileReader(); r.onload=(re)=>setLogoUrl(re.target?.result as string); r.readAsDataURL(f); }
                      }} className="absolute inset-0 opacity-0 cursor-pointer" />
                      <div className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/10 dark:bg-black/20 px-4 py-2 text-xs truncate">
                        {logoUrl ? "Logo Selected" : "Upload Logo"}
                      </div>
                    </div>
                    {logoUrl && <img src={logoUrl} className="h-10 w-10 object-contain rounded border border-black/10" />}
                  </div>
                </div>

                <PasswordInput value={password} onChange={setPassword} placeholder="Password" />
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm Password" />

                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-white/20 dark:bg-white/10 py-3 font-bold text-black dark:text-white hover:bg-white/30 transition-all disabled:opacity-40">
                  {loading ? "Creating…" : "Create"}
                </button>
              </form>
            </div>

            {/* Company List */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Companies</h2>
                  <p className="mt-1 text-sm text-black/55 dark:text-white/55">Manage tenants and Influx sources.</p>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">{loadingList ? "Loading…" : `${companies.length} total`}</div>
              </div>

              <div className="mt-6 space-y-3">
                {companies.map((c) => (
                  <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-4 py-3">
                    {editingCompany?.id === c.id ? (
                      /* Edit Mode */
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Company Name" className="w-full rounded-xl bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none border border-black/10" />
                          <input value={editLoginId} onChange={(e) => setEditLoginId(e.target.value)} placeholder="Login ID" className="w-full rounded-xl bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none border border-black/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase opacity-40 px-1">Tanks</label>
                             <input type="number" min={1} value={editTanksCount} onChange={(e) => setEditTanksCount(Number(e.target.value))} className="w-full rounded-xl bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none border border-black/10" />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase opacity-40 px-1">Logo URL/Data</label>
                             <div className="flex gap-2">
                                <input value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} placeholder="Logo Source..." className="flex-1 rounded-xl bg-white dark:bg-black/20 px-3 py-2 text-xs outline-none border border-black/10" />
                                <div className="relative">
                                  <input type="file" accept="image/*" onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if(f){ const r=new FileReader(); r.onload=(re)=>setEditLogoUrl(re.target?.result as string); r.readAsDataURL(f); }
                                  }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                  <div className="rounded-xl bg-white/10 border border-black/10 px-2 py-2 text-[10px] font-bold">Upload</div>
                                </div>
                             </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <select value={editOrg} onChange={(e) => { setEditOrg(e.target.value); setEditBucket(""); fetchBuckets(e.target.value, true); }} className="w-full rounded-xl bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none border border-black/10">
                            <option value="">Influx Org</option>
                            {availableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          <select disabled={!editOrg} value={editBucket} onChange={(e) => setEditBucket(e.target.value)} className="w-full rounded-xl bg-white dark:bg-black/20 px-3 py-2 text-sm outline-none border border-black/10 disabled:opacity-40">
                            <option value="">Influx Bucket</option>
                            {availableEditBuckets.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={saveEdit} className="flex-1 rounded-xl bg-black dark:bg-white text-white dark:text-black py-2 font-bold text-sm">Save</button>
                          <button onClick={() => setEditingCompany(null)} className="px-4 rounded-xl border border-black/10 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-1 items-center gap-4">
                          <div className="relative group h-12 w-24 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white/40 dark:bg-black/40 flex items-center justify-center">
                            {c.logoUrl ? <img src={c.logoUrl} className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] opacity-30 font-bold uppercase">No Logo</span>}
                            <button onClick={() => startEdit(c)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-white uppercase">Update Logo</button>
                          </div>
                          <div>
                            <div className="font-bold">{c.name}</div>
                            <div className="text-[10px] text-black/50 dark:text-white/50 uppercase tracking-widest font-semibold flex flex-col gap-0.5">
                              <span>ID: <span className="text-black dark:text-white">{c.companyLoginId}</span> • Tanks: <span className="text-black dark:text-white">{c.tanksCount}</span></span>
                              <div className="flex gap-2">
                                <span>Org: <span className="text-black dark:text-white">{availableOrgs.find(o => o.id === c.influxOrg)?.name || "N/A"}</span></span>
                                <span>Bucket: <span className="text-black dark:text-white">{c.influxBucket || "N/A"}</span></span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {c.pwd_reset_requested && !c.pwd_reset_approved && (
                            <button onClick={() => approveReset(c.id)} className="rounded-xl bg-emerald-500 px-3 py-1.5 text-[10px] font-bold text-white uppercase">Reset</button>
                          )}
                          <button onClick={() => startEdit(c)} className="rounded-xl border border-black/10 bg-white dark:bg-white/5 px-4 py-2 text-xs font-bold transition hover:bg-black/5">Edit</button>
                          <Link href={`/company/${c.slug}/setup`} className="rounded-xl border border-black/10 bg-white dark:bg-white/5 px-4 py-2 text-xs font-bold transition hover:bg-black/5">Open</Link>
                          <button onClick={() => removeCompany(c.id)} className="rounded-xl bg-red-500/10 text-red-600 px-4 py-2 text-xs font-bold border border-red-500/20 transition hover:bg-red-500 hover:text-white">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}