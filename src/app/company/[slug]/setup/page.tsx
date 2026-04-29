"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TopHero from "@/components/ui/TopHero";
import PasswordInput from "@/components/ui/PasswordInput";
import type { AlarmMap, TankAlarmLimits } from "@/types/alarm";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type VolumeUnit = "L" | "%" | "m³";
type TemperatureUnit = "°C" | "°F";

type TankSetupItem = {
  id: string;
  name: string;
  capacityLiters: number;
  variant?: "rect";
  metrics: [
    { channel: string; type: "volume"; unit: VolumeUnit },
    { channel: string; type: "temperature"; unit: TemperatureUnit }
  ];
};

const VOLUME_UNITS: VolumeUnit[] = ["L", "%", "m³"];
const TEMPERATURE_UNITS: TemperatureUnit[] = ["°C", "°F"];

function makeDefaultTank(i: number): TankSetupItem {
  return {
    id: `tank-${i + 1}`,
    name: `Tank ${i + 1}`,
    capacityLiters: 1000,
    variant: "rect",
    metrics: [
      {
        channel: `CH${i * 2 + 1}`,
        type: "volume",
        unit: "L",
      },
      {
        channel: `CH${i * 2 + 2}`,
        type: "temperature",
        unit: "°C",
      },
    ],
  };
}

function normalizeVolumeMetric(
  metric: any,
  fallbackChannel: string
): TankSetupItem["metrics"][0] {
  const unit = VOLUME_UNITS.includes(metric?.unit) ? metric.unit : "L";
  return {
    channel: String(metric?.channel ?? fallbackChannel).trim(),
    type: "volume",
    unit,
  };
}

function normalizeTemperatureMetric(
  metric: any,
  fallbackChannel: string
): TankSetupItem["metrics"][1] {
  const unit = TEMPERATURE_UNITS.includes(metric?.unit) ? metric.unit : "°C";
  return {
    channel: String(metric?.channel ?? fallbackChannel).trim(),
    type: "temperature",
    unit,
  };
}

function normalizeTank(
  t: Partial<TankSetupItem> | undefined,
  i: number
): TankSetupItem {
  const metrics = Array.isArray(t?.metrics) ? t!.metrics : [];

  return {
    id: t?.id || `tank-${i + 1}`,
    name: t?.name?.trim() || `Tank ${i + 1}`,
    capacityLiters: clamp(Number(t?.capacityLiters ?? 1000) || 0, 1, 1_000_000),
    variant: "rect",
    metrics: [
      normalizeVolumeMetric(metrics[0], `CH${i * 2 + 1}`),
      normalizeTemperatureMetric(metrics[1], `CH${i * 2 + 2}`),
    ],
  };
}

function tankKey(i: number) {
  return `Tank ${i + 1}`;
}

function numOrUndef(v: any): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function cleanLimits(l: Partial<TankAlarmLimits>): TankAlarmLimits {
  const out: TankAlarmLimits = {};

  const minVolumeL = numOrUndef(l.minVolumeL);
  const maxVolumeL = numOrUndef(l.maxVolumeL);
  const minTempC = numOrUndef(l.minTempC);
  const maxTempC = numOrUndef(l.maxTempC);

  if (minVolumeL !== undefined) out.minVolumeL = minVolumeL;
  if (maxVolumeL !== undefined) out.maxVolumeL = maxVolumeL;
  if (minTempC !== undefined) out.minTempC = minTempC;
  if (maxTempC !== undefined) out.maxTempC = maxTempC;

  return out;
}

function isEmptyLimits(l?: TankAlarmLimits) {
  if (!l) return true;
  return (
    typeof l.minVolumeL !== "number" &&
    typeof l.maxVolumeL !== "number" &&
    typeof l.minTempC !== "number" &&
    typeof l.maxTempC !== "number"
  );
}

function getTankValidationError(tank: TankSetupItem): string | null {
  const [volumeMetric, temperatureMetric] = tank.metrics;

  if (!tank.name.trim()) return "Tank name is required.";
  if (!volumeMetric.channel.trim()) return `${tank.name}: volume channel is required.`;
  if (!temperatureMetric.channel.trim()) return `${tank.name}: temperature channel is required.`;
  if (volumeMetric.channel === temperatureMetric.channel) {
    return `${tank.name}: volume and temperature channels must be different.`;
  }
  if (!(tank.capacityLiters > 0)) return `${tank.name}: capacity must be greater than 0.`;

  return null;
}

function buildCanonicalAlarmMap(
  source: AlarmMap,
  tanks: TankSetupItem[],
  tanksCount: number
): AlarmMap {
  const next: AlarmMap = {};

  for (let i = 0; i < tanksCount; i++) {
    const canonicalKey = tankKey(i);
    const tank = tanks[i];
    if (!tank) continue;

    const candidates = [canonicalKey, tank.name, tank.id].filter(Boolean);

    let merged: TankAlarmLimits = {};

    for (const key of candidates) {
      const found = source[key];
      if (!found) continue;
      merged = { ...merged, ...found };
    }

    merged = cleanLimits(merged);

    if (!isEmptyLimits(merged)) {
      next[canonicalKey] = merged;
    }
  }

  return next;
}

export default function CompanySetupPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [tanksCount, setTanksCount] = useState(4);
  const [tanks, setTanks] = useState<TankSetupItem[]>([
    makeDefaultTank(0),
    makeDefaultTank(1),
    makeDefaultTank(2),
    makeDefaultTank(3),
  ]);

  const [applyAllCap, setApplyAllCap] = useState<number>(1000);
  const [alarmMap, setAlarmMap] = useState<AlarmMap>({});

  const [applyAllMinVol, setApplyAllMinVol] = useState<string>("");
  const [applyAllMaxVol, setApplyAllMaxVol] = useState<string>("");
  const [applyAllMinTemp, setApplyAllMinTemp] = useState<string>("");
  const [applyAllMaxTemp, setApplyAllMaxTemp] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [pwdResetRequested, setPwdResetRequested] = useState(false);
  const [pwdResetApproved, setPwdResetApproved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPwd, setResettingPwd] = useState(false);

    const loadFromServer = useCallback(async (silent = false) => {
      try {
        if (!silent) {
          setInitialLoading(true);
          setMsg(null);
        }

        const res = await fetch(
          `/api/company/settings?slug=${encodeURIComponent(slug)}&t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        const j = await res.json().catch(() => ({}));

        if (!res.ok || !j?.ok) {
          throw new Error(j?.error || "Failed to load settings");
        }

        const countFromCompany = clamp(
          Number(j?.company?.tanks_count ?? j?.company?.tanksCount ?? 4),
          1,
          20
        );

        const tankCapacities = Array.isArray(j?.company?.tank_capacities)
          ? j.company.tank_capacities
          : Array.isArray(j?.company?.tankCapacities)
          ? j.company.tankCapacities
          : [];

        const serverTanks = Array.isArray(j?.tanks) ? j.tanks : [];
        const nextTanks = Array.from({ length: countFromCompany }, (_, i) => {
          const fromApi = serverTanks[i];

          if (fromApi) {
            return normalizeTank(
              {
                id: fromApi.id ?? `tank-${i + 1}`,
                name: fromApi.name ?? fromApi.tank_name ?? `Tank ${i + 1}`,
                capacityLiters:
                  Number(fromApi.capacityLiters ?? fromApi.capacity_liters) ||
                  Number(tankCapacities[i]) ||
                  1000,
                variant: "rect",
                metrics: [
                  {
                    channel:
                      fromApi.metrics?.[0]?.channel ??
                      fromApi.volumeChannel ??
                      fromApi.volume_channel ??
                      `CH${i * 2 + 1}`,
                    type: "volume",
                    unit:
                      fromApi.metrics?.[0]?.unit ??
                      fromApi.volumeUnit ??
                      fromApi.volume_unit ??
                      "L",
                  },
                  {
                    channel:
                      fromApi.metrics?.[1]?.channel ??
                      fromApi.temperatureChannel ??
                      fromApi.temperature_channel ??
                      `CH${i * 2 + 2}`,
                    type: "temperature",
                    unit:
                      fromApi.metrics?.[1]?.unit ??
                      fromApi.temperatureUnit ??
                      fromApi.temperature_unit ??
                      "°C",
                  },
                ],
              },
              i
            );
          }

          return normalizeTank(
            {
              ...makeDefaultTank(i),
              capacityLiters: Number(tankCapacities[i]) || 1000,
            },
            i
          );
        });

        const nextAlarmMap = buildCanonicalAlarmMap(
          (j?.alarms ?? {}) as AlarmMap,
          nextTanks,
          countFromCompany
        );

        setTanksCount(countFromCompany);
        setTanks(nextTanks);
        setApplyAllCap(nextTanks?.[0]?.capacityLiters ?? 1000);
        setAlarmMap(nextAlarmMap);
        setPwdResetRequested(!!j?.company?.pwd_reset_requested);
        setPwdResetApproved(!!j?.company?.pwd_reset_approved);
      } catch (e: any) {
        setMsg({
          type: "err",
          text: e?.message || "Failed to load settings",
        });
      } finally {
        setInitialLoading(false);
      }
    }, [slug]);

    useEffect(() => {
      if (slug) loadFromServer();
    }, [slug, loadFromServer]);

    useVisibilityPolling(() => loadFromServer(true), 8000);

    useEffect(() => {
      if (msg) {
        const timer = setTimeout(() => setMsg(null), 3000);
        return () => clearTimeout(timer);
      }
    }, [msg]);

  const totalCapacity = useMemo(
    () =>
      tanks.reduce(
        (sum, t) => sum + (Number.isFinite(t.capacityLiters) ? t.capacityLiters : 0),
        0
      ),
    [tanks]
  );

  function syncTanksToCount(nextCount: number) {
    setTanks((prev) => {
      const nextTanks = Array.from({ length: nextCount }, (_, i) =>
        normalizeTank(prev[i], i)
      );

      setAlarmMap((prevAlarmMap) =>
        buildCanonicalAlarmMap(prevAlarmMap, nextTanks, nextCount)
      );

      return nextTanks;
    });
  }

  function updateTankField<K extends "name" | "capacityLiters">(
    i: number,
    key: K,
    value: TankSetupItem[K]
  ) {
    setTanks((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [key]: value };
      return copy;
    });
  }

  function updateVolumeMetricField(
    tankIndex: number,
    field: "channel" | "unit",
    value: string
  ) {
    setTanks((prev) => {
      const copy = [...prev];
      const tank = { ...copy[tankIndex] };
      const metrics = [...tank.metrics] as TankSetupItem["metrics"];

      metrics[0] = {
        ...metrics[0],
        type: "volume",
        [field]: value,
      } as TankSetupItem["metrics"][0];

      tank.metrics = metrics;
      copy[tankIndex] = tank;
      return copy;
    });
  }

  function updateTemperatureMetricField(
    tankIndex: number,
    field: "channel" | "unit",
    value: string
  ) {
    setTanks((prev) => {
      const copy = [...prev];
      const tank = { ...copy[tankIndex] };
      const metrics = [...tank.metrics] as TankSetupItem["metrics"];

      metrics[1] = {
        ...metrics[1],
        type: "temperature",
        [field]: value,
      } as TankSetupItem["metrics"][1];

      tank.metrics = metrics;
      copy[tankIndex] = tank;
      return copy;
    });
  }

  function applyToAllCap() {
    const v = clamp(Number(applyAllCap) || 0, 1, 1_000_000);
    setTanks((prev) =>
      prev.map((t) => ({
        ...t,
        capacityLiters: v,
      }))
    );
  }

  function updateTankLimit(i: number, patch: Partial<TankAlarmLimits>) {
    const key = tankKey(i);

    setAlarmMap((prev) => {
      const current = cleanLimits(prev[key] ?? {});
      const next = cleanLimits({ ...current, ...patch });
      const copy = { ...prev };

      if (isEmptyLimits(next)) delete copy[key];
      else copy[key] = next;

      return buildCanonicalAlarmMap(copy, tanks, tanksCount);
    });
  }

  function applyLimitsToAll() {
    const minVol = numOrUndef(applyAllMinVol);
    const maxVol = numOrUndef(applyAllMaxVol);
    const minTemp = numOrUndef(applyAllMinTemp);
    const maxTemp = numOrUndef(applyAllMaxTemp);

    setAlarmMap((prev) => {
      const copy: AlarmMap = { ...prev };

      for (let i = 0; i < tanksCount; i++) {
        const key = tankKey(i);
        const current = cleanLimits(copy[key] ?? {});
        const next = cleanLimits({
          ...current,
          ...(minVol !== undefined ? { minVolumeL: minVol } : {}),
          ...(maxVol !== undefined ? { maxVolumeL: maxVol } : {}),
          ...(minTemp !== undefined ? { minTempC: minTemp } : {}),
          ...(maxTemp !== undefined ? { maxTempC: maxTemp } : {}),
        });

        if (isEmptyLimits(next)) delete copy[key];
        else copy[key] = next;
      }

      return buildCanonicalAlarmMap(copy, tanks, tanksCount);
    });
  }

  async function saveAndGo() {
    if (!slug) return;

    setMsg(null);
    setSaving(true);

    const cleanCount = clamp(Math.round(tanksCount), 1, 20);
    const cleanTanks = Array.from({ length: cleanCount }, (_, i) =>
      normalizeTank(tanks[i], i)
    );

    for (const tank of cleanTanks) {
      const err = getTankValidationError(tank);
      if (err) {
        setSaving(false);
        setMsg({ type: "err", text: err });
        return;
      }
    }

    const canonicalAlarmMap = buildCanonicalAlarmMap(alarmMap, cleanTanks, cleanCount);

    try {
      const res = await fetch("/api/company/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          tanksCount: cleanCount,
          tankCapacities: cleanTanks.map((t) => t.capacityLiters),
          tanks: cleanTanks,
          alarms: canonicalAlarmMap,
        }),
      });

      const j = await res.json().catch(() => ({}));

      setSaving(false);

      if (!res.ok || !j?.ok) {
        setMsg({ type: "err", text: j?.error ?? "Failed to save settings" });
        return;
      }

      setAlarmMap(canonicalAlarmMap);
      setMsg({ type: "ok", text: "Saved ✅ Redirecting…" });
      window.location.href = `/company/${slug}/dashboard`;
    } catch {
      setSaving(false);
      setMsg({ type: "err", text: "Failed to save settings" });
    }
  }

  async function uploadCSV(file: File) {
    if (!slug) return;

    setMsg(null);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("slug", slug);

    const res = await fetch("/api/company/upload-csv", {
      method: "POST",
      body: fd,
    });

    const j = await res.json().catch(() => ({}));
    setUploading(false);

    if (!res.ok) {
      setMsg({ type: "err", text: j?.error ?? "CSV upload failed" });
      return;
    }

    setMsg({ type: "ok", text: "CSV uploaded ✅" });
  }

  async function handleRequestReset() {
    if (!confirm("Request admin to allow you to change your password?")) return;
    setMsg(null);
    try {
      const res = await fetch("/api/company/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setPwdResetRequested(true);
        setMsg({ type: "ok", text: "Request sent to admin." });
      } else {
        setMsg({ type: "err", text: "Failed to send request." });
      }
    } catch {
      setMsg({ type: "err", text: "Network error." });
    }
  }

  async function handlePasswordReset() {
    if (!newPassword || newPassword.length < 4) {
      setMsg({ type: "err", text: "New password must be at least 4 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: "err", text: "Passwords do not match." });
      return;
    }

    setMsg(null);
    setResettingPwd(true);

    try {
      const res = await fetch("/api/company/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword, slug }),
      });
      if (res.ok) {
        setPwdResetRequested(false);
        setPwdResetApproved(false);
        setNewPassword("");
        setConfirmPassword("");
        setMsg({ type: "ok", text: "Password updated successfully ✅" });
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: "err", text: j?.error || "Failed to update password." });
      }
    } catch {
      setMsg({ type: "err", text: "Network error." });
    } finally {
      setResettingPwd(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-black dark:text-white transition-all duration-500">
      <BackgroundFX />
      <div className="relative">
        <TopHero
          brand="Ekatva"
          eyebrow="COMPANY SETUP"
          titleLine1="Configure"
          titleLine2="Your Tanks"
          subtitle="Fixed volume & temperature channels. Admin chooses channel, unit, and capacity."
          navItems={[
            { label: "Setup", href: `/company/${slug}/setup` },
            { label: "Dashboard", href: `/company/${slug}/dashboard` },
            { label: "About", href: "https://ekatvatechnovation.com/" },
          ]}
        />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-6">
              {/* Security Card */}
              <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="text-sm font-semibold">Security</h3>
                {!pwdResetRequested && !pwdResetApproved && (
                  <button onClick={handleRequestReset} className="mt-3 w-full rounded-xl bg-black/5 dark:bg-white/5 py-2 text-xs font-bold border border-black/10 hover:bg-black/10 transition">Request Password Change</button>
                )}
                {pwdResetRequested && !pwdResetApproved && (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">Waiting for admin approval...</div>
                )}
                {pwdResetApproved && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 font-medium">Approved! Set new password:</div>
                    <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="New Password" className="!py-2 !text-xs" />
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm Password" className="!py-2 !text-xs" />
                    <button onClick={handlePasswordReset} disabled={resettingPwd} className="w-full rounded-xl bg-black dark:bg-white py-2 text-xs font-bold text-white dark:text-black transition-opacity hover:opacity-90">{resettingPwd ? "Updating..." : "Update Password"}</button>
                  </div>
                )}
              </div>

              {/* Tank Settings Card */}
              <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h2 className="text-lg font-semibold">Tank Settings</h2>
                <p className="mt-1 text-sm text-black/60 dark:text-white/55">Set counts, names & alarms.</p>

                {initialLoading && (
                  <div className="mt-4 rounded-xl bg-black/5 dark:bg-white/5 p-3 text-xs text-black/50 dark:text-white/50">Loading settings…</div>
                )}

              <div className="mt-6">
                <div className="flex justify-between text-sm">
                  <span>Tanks count</span>
                  <span className="font-bold">{tanksCount}</span>
                </div>
                <input
                  type="range" min={1} max={20}
                  value={tanksCount}
                  onChange={(e) => {
                    const n = clamp(Number(e.target.value), 1, 20);
                    setTanksCount(n);
                    syncTanksToCount(n);
                  }}
                  className="mt-3 w-full"
                />
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 bg-black/5 dark:bg-black/20">
                  <div className="text-sm font-medium">Bulk Capacity</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number" value={applyAllCap}
                      onChange={(e) => setApplyAllCap(Number(e.target.value))}
                      className="w-full rounded-xl border border-black/10 bg-black/5 dark:bg-black/30 px-3 py-2 text-sm outline-none backdrop-blur-sm"
                    />
                    <button onClick={applyToAllCap} className="rounded-xl bg-black dark:bg-white px-4 py-2 text-sm font-bold text-white dark:text-black hover:opacity-90">Apply</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 bg-black/5 dark:bg-black/20">
                  <div className="text-sm font-medium">Bulk Alarm Limits</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={applyAllMinVol} onChange={(e) => setApplyAllMinVol(e.target.value)} placeholder="Min Vol" className="w-full rounded-xl border border-black/10 bg-black/5 dark:bg-black/30 px-3 py-2 text-xs backdrop-blur-sm" />
                    <input value={applyAllMaxVol} onChange={(e) => setApplyAllMaxVol(e.target.value)} placeholder="Max Vol" className="w-full rounded-xl border border-black/10 bg-black/5 dark:bg-black/30 px-3 py-2 text-xs backdrop-blur-sm" />
                    <input value={applyAllMinTemp} onChange={(e) => setApplyAllMinTemp(e.target.value)} placeholder="Min Temp" className="w-full rounded-xl border border-black/10 bg-black/5 dark:bg-black/30 px-3 py-2 text-xs backdrop-blur-sm" />
                    <input value={applyAllMaxTemp} onChange={(e) => setApplyAllMaxTemp(e.target.value)} placeholder="Max Temp" className="w-full rounded-xl border border-black/10 bg-black/5 dark:bg-black/30 px-3 py-2 text-xs backdrop-blur-sm" />
                  </div>
                  <button onClick={applyLimitsToAll} className="mt-3 w-full rounded-xl bg-black/5 dark:bg-white/10 py-2 border border-black/10 font-bold hover:bg-black/10 transition text-xs">Apply to all</button>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-medium">CSV Data Import</div>
                <input
                  type="file" accept=".csv" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if(f) uploadCSV(f); }}
                  className="mt-2 text-xs w-full file:mr-4 file:rounded-xl file:border file:border-black/10 dark:file:border-white/10 file:bg-black/5 dark:file:bg-white/10 file:backdrop-blur-md file:px-4 file:py-2 file:text-black dark:file:text-white hover:file:bg-black/10 dark:hover:file:bg-white/20 transition cursor-pointer"
                />
              </div>


              {msg && (
                <div className={`mt-6 rounded-xl border p-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${msg.type === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "bg-red-500/10 border-red-500/30 text-red-600"}`}>
                  {msg.text}
                </div>
              )}

              <button onClick={saveAndGo} disabled={saving || initialLoading} className="mt-6 w-full rounded-2xl bg-black dark:bg-white py-3 font-bold text-white dark:text-black shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50">
                {saving ? "Saving…" : "Save & Continue"}
              </button>
              
              <a href={`/company/${slug}/dashboard`} className="mt-4 block text-center text-xs text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition">
                Skip to Dashboard →
              </a>
            </div>
          </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-2 overflow-y-auto max-h-[1200px]">
              <h2 className="text-lg font-semibold">Individual Tank Configuration</h2>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: tanksCount }).map((_, i) => {
                  const key = tankKey(i);
                  const tank = tanks[i] ?? makeDefaultTank(i);
                  const lim = cleanLimits((alarmMap[key] ?? {}) as TankAlarmLimits);
                  
                  return (
                    <div key={key} className="rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-black/5 dark:bg-black/20 text-xs">
                      <div className="flex justify-between items-center font-bold mb-4 border-b border-black/5 dark:border-white/5 pb-2">
                        <span className="text-sm">{key}</span>
                        {!isEmptyLimits(lim) && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">Limits Active</span>}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="opacity-60 block mb-1">Display Name</span>
                            <input value={tank.name} onChange={(e) => updateTankField(i, "name", e.target.value)} className="w-full border border-black/10 rounded-xl px-3 py-2 bg-black/5 dark:bg-black/30 transition-shadow focus:shadow-md outline-none backdrop-blur-sm shadow-inner" />
                          </div>
                          <div>
                            <span className="opacity-60 block mb-1">Capacity (L)</span>
                            <input type="number" value={tank.capacityLiters} onChange={(e) => updateTankField(i, "capacityLiters", Number(e.target.value))} className="w-full border border-black/10 rounded-xl px-3 py-2 bg-black/5 dark:bg-black/30 outline-none backdrop-blur-sm shadow-inner" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl space-y-2 border border-black/5">
                            <span className="font-bold opacity-80 block text-[10px] uppercase tracking-wider">Metric 1 (Vol)</span>
                            <div>
                                <span className="text-[10px] opacity-60">Channel</span>
                                <select value={tank.metrics[0].channel} onChange={(e) => updateVolumeMetricField(i, "channel", e.target.value)} className="w-full mt-1 border border-black/5 rounded-lg py-1 px-1 bg-black/5 dark:bg-black/20">
                                    {Array.from({length:24}, (_, idx) => `CH${idx+1}`).map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className="text-[10px] opacity-60">Unit</span>
                                <select value={tank.metrics[0].unit} onChange={(e) => updateVolumeMetricField(i, "unit", e.target.value as VolumeUnit)} className="w-full mt-1 border border-black/5 rounded-lg py-1 px-1 bg-black/5 dark:bg-black/20">
                                    {VOLUME_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                          </div>

                          <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl space-y-2 border border-black/5">
                            <span className="font-bold opacity-80 block text-[10px] uppercase tracking-wider">Metric 2 (Temp)</span>
                            <div>
                                <span className="text-[10px] opacity-60">Channel</span>
                                <select value={tank.metrics[1].channel} onChange={(e) => updateTemperatureMetricField(i, "channel", e.target.value)} className="w-full mt-1 border border-black/5 rounded-lg py-1 px-1 bg-black/5 dark:bg-black/20">
                                    {Array.from({length:24}, (_, idx) => `CH${idx+1}`).map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className="text-[10px] opacity-60">Unit</span>
                                <select value={tank.metrics[1].unit} onChange={(e) => updateTemperatureMetricField(i, "unit", e.target.value as TemperatureUnit)} className="w-full mt-1 border border-black/5 rounded-lg py-1 px-1 bg-black/5 dark:bg-black/20">
                                    {TEMPERATURE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                          </div>
                        </div>

                        <div>
                            <span className="opacity-60 block mb-2 font-medium">Alarm Limits (Thresholds)</span>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                <div className="space-y-1">
                                    <span className="text-[10px] opacity-50">Min Volume</span>
                                    <input value={typeof lim.minVolumeL === "number" ? String(lim.minVolumeL) : ""} onChange={(e) => updateTankLimit(i, { minVolumeL: numOrUndef(e.target.value) })} placeholder="N/A" className="w-full border border-black/5 rounded-lg px-2 py-1 bg-black/5 dark:bg-black/10 outline-none backdrop-blur-sm" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] opacity-50">Max Volume</span>
                                    <input value={typeof lim.maxVolumeL === "number" ? String(lim.maxVolumeL) : ""} onChange={(e) => updateTankLimit(i, { maxVolumeL: numOrUndef(e.target.value) })} placeholder="N/A" className="w-full border border-black/5 rounded-lg px-2 py-1 bg-black/5 dark:bg-black/10 outline-none backdrop-blur-sm" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] opacity-50">Min Temp (°C)</span>
                                    <input value={typeof lim.minTempC === "number" ? String(lim.minTempC) : ""} onChange={(e) => updateTankLimit(i, { minTempC: numOrUndef(e.target.value) })} placeholder="N/A" className="w-full border border-black/5 rounded-lg px-2 py-1 bg-black/5 dark:bg-black/10 outline-none backdrop-blur-sm" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] opacity-50">Max Temp (°C)</span>
                                    <input value={typeof lim.maxTempC === "number" ? String(lim.maxTempC) : ""} onChange={(e) => updateTankLimit(i, { maxTempC: numOrUndef(e.target.value) })} placeholder="N/A" className="w-full border border-black/5 rounded-lg px-2 py-1 bg-black/5 dark:bg-black/10 outline-none backdrop-blur-sm" />
                                </div>
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-8 rounded-2xl p-6 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs space-y-3">
                  <h4 className="font-bold opacity-80 uppercase tracking-widest text-[10px]">Technical Information</h4>
                  <p className="opacity-60 leading-relaxed">
                      All tanks are configured with dual-metric tracking. Volume measurements are normalized to Liters for analytics, while temperature is tracked in Celsius. Calibration logic automatically handles unit conversion based on your selections.
                  </p>
                  <ul className="list-disc pl-4 opacity-50 space-y-1">
                      <li>Metric 1: High-precision volume/level tracking.</li>
                      <li>Metric 2: Thermal monitoring and compensation.</li>
                      <li>Scaling: 1-20 tanks per industrial instance.</li>
                  </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}