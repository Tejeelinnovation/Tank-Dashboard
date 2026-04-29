"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import TankGrid, { type Tank, type AlarmEvent } from "@/components/tanks/TankGrid";
import type { TankAlarmLimits } from "@/types/alarm";
import TopHero from "@/components/ui/TopHero";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TankDetailsModal from "@/components/tanks/TankDetailsModal";

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

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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

function convertVolumeToLiters(
  raw: number,
  unit: VolumeUnit,
  capacityLiters: number
) {
  if (unit === "L") return raw;
  if (unit === "%") return (raw / 100) * capacityLiters;
  if (unit === "m³") return raw * 1000;
  return raw;
}

function convertTemperatureToC(raw: number, unit: TemperatureUnit) {
  if (unit === "°F") return ((raw - 32) * 5) / 9;
  return raw;
}

function getVolumePercent(raw: number, unit: VolumeUnit, capacityLiters: number) {
  const liters = convertVolumeToLiters(raw, unit, capacityLiters);
  if (!(capacityLiters > 0)) return 0;
  return clamp((liters / capacityLiters) * 100, 0, 100);
}

export default function CompanyDashboardPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [tanks, setTanks] = useState<Tank[]>([]);
  const [setupTanks, setSetupTanks] = useState<TankSetupItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [openTankId, setOpenTankId] = useState<string | null>(null);
  const [alarmMap, setAlarmMap] = useState<Record<string, TankAlarmLimits>>({});

  const modalTank = useMemo(() => {
    if (!openTankId) return null;
    return tanks.find((t) => String(t.id) === String(openTankId)) ?? null;
  }, [tanks, openTankId]);

  const loadSettings = useCallback(async () => {
    if (!slug) return;
    try {
      const settingsRes = await fetch(`/api/company/settings?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const settingsJson = await settingsRes.json().catch(() => ({}));
      if (!settingsRes.ok || !settingsJson?.ok) return;

      const tanksCount = clamp(Number(settingsJson?.company?.tanksCount ?? 4), 1, 20);
      const tankCapacities = settingsJson?.company?.tankCapacities ?? [];
      const settingsRows = settingsJson?.tanks ?? [];

      const normalizedSetup: TankSetupItem[] = Array.from({ length: tanksCount }, (_, i) => {
        const row = settingsRows[i];
        if (!row) return { ...makeDefaultTank(i), capacityLiters: Number(tankCapacities[i]) || 1000 };
        return {
          id: String(row.id ?? `tank-${i + 1}`),
          name: String(row.name ?? `Tank ${i + 1}`).trim(),
          capacityLiters: Number(row.capacityLiters) || Number(tankCapacities[i]) || 1000,
          metrics: [
            { 
               channel: String(row.volumeChannel ?? `CH${i * 2 + 1}`).trim(), 
               type: "volume", 
               unit: (String(row.volumeUnit || "L").trim()) as VolumeUnit 
            },
            { 
               channel: String(row.temperatureChannel ?? `CH${i * 2 + 2}`).trim(), 
               type: "temperature", 
               unit: (String(row.temperatureUnit || "°C").trim()) as TemperatureUnit 
            },
          ]
        };
      });
      setSetupTanks(normalizedSetup);
      setAlarmMap(settingsJson?.alarms || {});
    } catch (e) { console.error("Failed to load settings", e); }
  }, [slug]);

  const loadData = useCallback(async () => {
    if (!slug || setupTanks.length === 0) return;
    try {
      const influxRes = await fetch("/api/influx/latest", { cache: "no-store" });
      const influxJson = await influxRes.json().catch(() => ({}));
      if (!influxRes.ok) throw new Error("Influx failed");

      const rows = Array.isArray(influxJson?.rows) ? influxJson.rows : [];
      const mapped: Tank[] = setupTanks.map((cfg) => {
        const volumeMetric = cfg.metrics[0];
        const temperatureMetric = cfg.metrics[1];
        const volumeRow = rows.find((r: any) => r.channel === volumeMetric.channel);
        const temperatureRow = rows.find((r: any) => r.channel === temperatureMetric.channel);
        const volumeRaw = toNumber(volumeRow?._value);
        const temperatureRaw = toNumber(temperatureRow?._value);

        let hasData = false;
        if (volumeRow?._time) {
          const pt = new Date(volumeRow._time).getTime();
          if (!Number.isNaN(pt) && Date.now() - pt <= 60 * 60 * 1000) hasData = true;
        }

        const level = volumeRaw !== undefined ? getVolumePercent(volumeRaw, volumeMetric.unit, cfg.capacityLiters) : 0;
        const temperatureC = temperatureRaw !== undefined ? convertTemperatureToC(temperatureRaw, temperatureMetric.unit) : undefined;

        return {
          id: cfg.id,
          name: cfg.name,
          level,
          temperatureC,
          capacityLiters: cfg.capacityLiters,
          variant: "rect",
          volumeChannel: volumeMetric.channel,
          temperatureChannel: temperatureMetric.channel,
          volumeUnit: volumeMetric.unit,
          temperatureUnit: temperatureMetric.unit,
          hasData,
          volumeValue: volumeRaw !== undefined ? Math.round(volumeRaw * 100) / 100 : 0,
          temperatureValue: temperatureRaw !== undefined ? Math.round(temperatureRaw * 10) / 10 : undefined,
        };
      });

      setTanks(mapped);
      setLoading(false);
    } catch (e) {
      setErr("Failed to update live data");
      setLoading(false);
    }
  }, [slug, setupTanks]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (setupTanks.length > 0) loadData();
  }, [setupTanks, loadData]);

  useVisibilityPolling(loadData, 10000);

  useEffect(() => {
    if (err) {
      const timer = setTimeout(() => setErr(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [err]);

  async function logoutCompany() {
    await fetch("/api/company/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  // Polling logic moved to useVisibilityPolling above.

  return (
    <main className="relative min-h-screen overflow-hidden text-black dark:text-white transition-colors duration-500">
      <BackgroundFX />

      <div className="relative">
        <TopHero
          brand="Ekatva"
          hideViewTanks={true}
          eyebrow="COMPANY DASHBOARD"
          titleLine1=""
          titleLine2=""
          subtitle="Live values from InfluxDB using fixed volume and temperature channels configured by the admin."
          navItems={[
            { label: "Setup", href: `/company/${slug}/setup` },
            { label: "Dashboard", href: `/company/${slug}/dashboard` },
            { label: "About", href: "https://ekatvatechnovation.com/" },
          ]}
        />

        {/* Logout and Request Password buttons removed - moved to Setup or top nav */}




        <section id="tanks" className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          {err ? (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            {/* Left side: Tanks */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-2">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-black dark:text-white md:text-2xl truncate">
                    Live Tanks
                  </h2>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/55">
                    Showing current configured volume and temperature channels from InfluxDB.
                  </p>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {loading ? "Loading…" : "Updated every 15s"}
                </div>
              </div>

              <TankGrid
                tanks={tanks}
                loading={loading}
                alarmMap={alarmMap}
                onAlarmList={setAlarms}
                onOpenTank={(t) => setOpenTankId(String(t.id))}
              />
            </div>

            {/* Right side: Alarms */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-xl lg:col-span-1 sticky top-6">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white md:text-xl">
                    Active Alarms
                  </h2>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/55">
                    Latest notifications.
                  </p>
                </div>
              </div>

              {alarms.length > 0 ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-50 dark:bg-red-500/10 p-4 backdrop-blur-xl">
                  <div className="space-y-3 text-xs text-black/70 dark:text-white/70">
                    {alarms.map((a, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1 border-b border-black/10 dark:border-white/10 pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="text-black/90 dark:text-white/90">
                          <span className="font-semibold">{a.tankName}</span>{" "}
                          <span className="text-red-200">— {a.reason}</span>
                        </div>
                        <div className="text-white/55">
                          Value:{" "}
                          {typeof a.volumeL === "number" ? `${a.volumeL}` : "--"} • Temp:{" "}
                          {typeof a.temperatureC === "number"
                            ? `${a.temperatureC}°C`
                            : "--"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 text-center text-sm text-black/55 dark:text-white/55">
                  No active alarms.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <TankDetailsModal
        open={!!openTankId}
        onClose={() => setOpenTankId(null)}
        tank={modalTank}
        alarmMap={alarmMap}
      />
    </main>
  );
}