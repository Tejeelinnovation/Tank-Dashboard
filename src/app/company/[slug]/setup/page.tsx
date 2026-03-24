"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TopHero from "@/components/ui/TopHero";
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

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function loadFromServer() {
      try {
        setInitialLoading(true);
        setMsg(null);

        const res = await fetch(
  `/api/company/settings?slug=${encodeURIComponent(slug)}`,
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

        if (!cancelled) {
          setTanksCount(countFromCompany);
          setTanks(nextTanks);
          setApplyAllCap(nextTanks?.[0]?.capacityLiters ?? 1000);
          setAlarmMap(nextAlarmMap);
        }
      } catch (e: any) {
        if (!cancelled) {
          setMsg({
            type: "err",
            text: e?.message || "Failed to load settings",
          });
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }

    loadFromServer();

    return () => {
      cancelled = true;
    };
  }, [slug]);

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

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <BackgroundFX />

      <div className="relative">
        <TopHero
          brand="Tankco."
          // ctaLabel="Logout"
          // onCtaClickHref="/login"
          eyebrow="COMPANY SETUP"
          titleLine1="Configure"
          titleLine2="Your Tanks"
          subtitle="Metric 1 is fixed as volume and Metric 2 is fixed as temperature. Admin only chooses channel, unit, and tank capacity."
          // navItems={[
          //   { label: "Dashboard", href: `/company/${slug}/dashboard` },
          // ]}
        />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border md:h-1/2 border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-1">
              <h2 className="text-lg font-semibold">Tank Settings</h2>
              <p className="mt-1 text-sm text-white/55">
                Set tank count, names, fixed volume/temperature channels, units, capacities, and alarms.
              </p>

              {initialLoading && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                  Loading saved settings…
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/70">Number of tanks</label>
                  <div className="text-sm font-semibold">{tanksCount}</div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={20}
                  value={tanksCount}
                  onChange={(e) => {
                    const n = clamp(Number(e.target.value), 1, 20);
                    setTanksCount(n);
                    syncTanksToCount(n);
                  }}
                  className="mt-3 w-full"
                />

                <div className="mt-3 text-xs text-white/50">
                  Total capacity: <span className="text-white/80">{totalCapacity.toLocaleString()}</span> L
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium">Apply capacity to all tanks</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={applyAllCap}
                    onChange={(e) => setApplyAllCap(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                    placeholder="Capacity for all tanks (L)"
                  />
                  <button
                    onClick={applyToAllCap}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium">Apply alarm limits to all tanks</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={applyAllMinVol}
                    onChange={(e) => setApplyAllMinVol(e.target.value)}
                    placeholder="Min Volume (L)"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                  />
                  <input
                    value={applyAllMaxVol}
                    onChange={(e) => setApplyAllMaxVol(e.target.value)}
                    placeholder="Max Volume (L)"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                  />
                  <input
                    value={applyAllMinTemp}
                    onChange={(e) => setApplyAllMinTemp(e.target.value)}
                    placeholder="Min Temp (°C)"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                  />
                  <input
                    value={applyAllMaxTemp}
                    onChange={(e) => setApplyAllMaxTemp(e.target.value)}
                    placeholder="Max Temp (°C)"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                  />
                </div>

                <button
                  onClick={applyLimitsToAll}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/90 hover:bg-white/15"
                >
                  Apply limits to all tanks
                </button>

                <div className="mt-2 text-[11px] text-white/50">
                  Leave a field blank to not set that limit.
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-medium">CSV Upload (optional)</div>
                <p className="mt-1 text-xs text-white/55">
                  CSV headers: <span className="text-white/80">TankName, Level, Temp</span>
                </p>

                <input
                  type="file"
                  accept=".csv"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadCSV(f);
                  }}
                  className="mt-3 block w-full text-xs text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:file:opacity-90"
                />
                {uploading && <div className="mt-2 text-xs text-white/60">Uploading…</div>}
              </div>

              {msg && (
                <div
                  className={[
                    "mt-6 rounded-xl border px-4 py-3 text-sm",
                    msg.type === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-red-500/30 bg-red-500/10 text-red-300",
                  ].join(" ")}
                >
                  {msg.text}
                </div>
              )}

              <button
                onClick={saveAndGo}
                disabled={saving || initialLoading}
                className="mt-6 w-full rounded-2xl bg-white py-3 font-semibold text-black disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & Go to Dashboard"}
              </button>

              <a
                href={`/company/${slug}/dashboard`}
                className="mt-3 block text-center text-xs text-white/60 hover:text-white/80"
              >
                Skip → Open Dashboard
              </a>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-2">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Per Tank Settings</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Capacity is used to convert L, %, or m³ into actual fill percentage and liters.
                  </p>
                </div>
                <div className="text-xs text-white/50">{tanksCount} tanks</div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: tanksCount }).map((_, i) => {
                  const key = tankKey(i);
                  const lim = cleanLimits((alarmMap[key] ?? {}) as TankAlarmLimits);
                  const tank = tanks[i] ?? makeDefaultTank(i);

                  return (
                    <div
                      key={key}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{key}</div>
                        <div className="text-xs text-white/50">
                          {isEmptyLimits(lim) ? "No limits" : "Limits set"}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs text-white/55">Tank name</div>
                        <input
                          type="text"
                          value={tank.name}
                          onChange={(e) => updateTankField(i, "name", e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                        />
                      </div>

                      <div className="mt-3">
                        <div className="text-xs text-white/55">Capacity (L)</div>
                        <input
                          type="number"
                          value={tank.capacityLiters}
                          onChange={(e) =>
                            updateTankField(
                              i,
                              "capacityLiters",
                              clamp(Number(e.target.value) || 0, 1, 1_000_000)
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                        />
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-medium text-white/80">Metric 1 — Volume</div>

                        <div className="mt-2">
                          <div className="text-xs text-white/55">Channel</div>
                          <select
                            value={tank.metrics[0].channel}
                            onChange={(e) => updateVolumeMetricField(i, "channel", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          >
                            {Array.from({ length: 24 }, (_, idx) => `CH${idx + 1}`).map((ch) => (
                              <option key={ch} value={ch}>
                                {ch}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-white/55">Unit</div>
                          <select
                            value={tank.metrics[0].unit}
                            onChange={(e) => updateVolumeMetricField(i, "unit", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          >
                            {VOLUME_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-medium text-white/80">
                          Metric 2 — Temperature
                        </div>

                        <div className="mt-2">
                          <div className="text-xs text-white/55">Channel</div>
                          <select
                            value={tank.metrics[1].channel}
                            onChange={(e) => updateTemperatureMetricField(i, "channel", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          >
                            {Array.from({ length: 24 }, (_, idx) => `CH${idx + 1}`).map((ch) => (
                              <option key={ch} value={ch}>
                                {ch}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-white/55">Unit</div>
                          <select
                            value={tank.metrics[1].unit}
                            onChange={(e) => updateTemperatureMetricField(i, "unit", e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          >
                            {TEMPERATURE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs text-white/55">Volume limits</div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input
                            value={typeof lim.minVolumeL === "number" ? String(lim.minVolumeL) : ""}
                            onChange={(e) =>
                              updateTankLimit(i, { minVolumeL: numOrUndef(e.target.value) })
                            }
                            placeholder="Min"
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          />
                          <input
                            value={typeof lim.maxVolumeL === "number" ? String(lim.maxVolumeL) : ""}
                            onChange={(e) =>
                              updateTankLimit(i, { maxVolumeL: numOrUndef(e.target.value) })
                            }
                            placeholder="Max"
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs text-white/55">Temp limits (°C)</div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input
                            value={typeof lim.minTempC === "number" ? String(lim.minTempC) : ""}
                            onChange={(e) =>
                              updateTankLimit(i, { minTempC: numOrUndef(e.target.value) })
                            }
                            placeholder="Min"
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          />
                          <input
                            value={typeof lim.maxTempC === "number" ? String(lim.maxTempC) : ""}
                            onChange={(e) =>
                              updateTankLimit(i, { maxTempC: numOrUndef(e.target.value) })
                            }
                            placeholder="Max"
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] text-white/45">
                        Metric 1 is fixed as volume and Metric 2 is fixed as temperature.
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/55">
                <div className="font-semibold text-white/80">How it works</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Metric 1 is always volume and Metric 2 is always temperature.</li>
                  <li>Admin only selects the channel and the unit for each metric.</li>
                  <li>Volume history and live values are converted correctly from L, %, or m³.</li>
                  <li>Temperature history and live values are converted correctly from °F to °C when needed.</li>
                  <li>Shape is fixed to rectangle for all tanks.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}