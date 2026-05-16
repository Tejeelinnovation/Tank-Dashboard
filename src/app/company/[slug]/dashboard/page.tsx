"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import TankGrid, { type Tank, type AlarmEvent } from "@/components/tanks/TankGrid";
import AlarmHistory from "@/components/alarms/AlarmHistory";
import type { TankAlarmLimits } from "@/types/alarm";
import TopHero from "@/components/ui/TopHero";
import BackgroundFX from "@/components/ui/BackgroundFX";
import TankDetailsModal from "@/components/tanks/TankDetailsModal";
import {
  type VolumeUnit,
  type TemperatureUnit,
  type MetricMode,
  convertMaToLiters,
  convertFromLiters,
  convertTemperature,
} from "@/lib/conversions";

type TankSetupItem = {
  id: string;
  name: string;
  capacityLiters: number;
  variant?: "rect";
  fluidColor?: string;
  tempColor?: string;
  disableVolume?: boolean;
  disableTemperature?: boolean;
  volumeMode?: MetricMode;
  temperatureMode?: MetricMode;
  volumeM?: number;
  volumeC?: number;
  temperatureM?: number;
  temperatureC_factor?: number;
  isDisabled?: boolean;
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

function normalizeVolumeUnit(value: unknown): VolumeUnit {
  const raw = String(value || "L").trim();

  const allowed = new Set([
    "L",
    "l",
    "liter",
    "liters",
    "ml",
    "mL",
    "gal",
    "gallon",
    "gallons",
  ]);

  return allowed.has(raw) ? (raw as VolumeUnit) : ("L" as VolumeUnit);
}

function normalizeTemperatureUnit(value: unknown): TemperatureUnit {
  const raw = String(value || "°C").trim();

  const allowed = new Set(["°C", "°F", "C", "F"]);

  return allowed.has(raw) ? (raw as TemperatureUnit) : ("°C" as TemperatureUnit);
}

function makeDefaultTank(i: number): TankSetupItem {
  return {
    id: `tank-${i + 1}`,
    name: `Tank ${i + 1}`,
    capacityLiters: 1000,
    variant: "rect",
    metrics: [
      { channel: `CH${i * 2 + 1}`, type: "volume", unit: "L" as VolumeUnit },
      { channel: `CH${i * 2 + 2}`, type: "temperature", unit: "°C" as TemperatureUnit },
    ],
  };
}

export default function CompanyDashboardPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [tanks, setTanks] = useState<Tank[]>([]);
  const [setupTanks, setSetupTanks] = useState<TankSetupItem[]>([]);
  const [companyBranding, setCompanyBranding] = useState<{
    name: string;
    logoUrl: string;
    influxOrg?: string;
    influxBucket?: string;
  }>({ name: "", logoUrl: "" });

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [openTankId, setOpenTankId] = useState<string | null>(null);
  const [alarmMap, setAlarmMap] = useState<Record<string, TankAlarmLimits>>({});
  const [userPermissions, setUserPermissions] = useState<{ tankKey: string; accessLevel: "view" | "edit" }[] | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);

  const modalTank = useMemo(() => {
    if (!openTankId) return null;
    return tanks.find((t) => String(t.id) === String(openTankId)) ?? null;
  }, [tanks, openTankId]);

  const loadSettings = useCallback(async () => {
    if (!slug) return;

    try {
      const settingsRes = await fetch(
        `/api/company/settings?slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );

      const settingsJson = await settingsRes.json().catch(() => ({}));

      if (!settingsRes.ok || !settingsJson?.ok) {
        setInitialLoading(false);
        return;
      }

      const company = settingsJson?.company || {};
      const tanksCount = clamp(Number(company.tanksCount ?? 1), 1, 20);
      const tankCapacities = company.tankCapacities ?? [];
      const settingsRows = settingsJson?.tanks ?? [];

      setCompanyBranding({
        name: company.name || "",
        logoUrl: company.logoUrl || "",
        influxOrg: company.influxOrg,
        influxBucket: company.influxBucket,
      });

      const isSubUser = settingsJson?.role === "user";

      const normalizedSetup: TankSetupItem[] = isSubUser
        ? settingsRows.map((row: any, i: number) => ({
          id: String(row.tankKey || row.id || `tank-${i + 1}`),
          name: String(row.tankName || row.name || row.tankKey || `Tank ${i + 1}`).trim(),
          capacityLiters: Number(row.capacityLiters) || Number(tankCapacities[i]) || 1000,
          variant: "rect",
          fluidColor: row.fluidColor || row.fluid_color,
          tempColor: row.tempColor || row.temp_color,
          disableVolume: !!(row.disableVolume ?? row.disable_volume),
          disableTemperature: !!(row.disableTemperature ?? row.disable_temperature),
          volumeMode: row.volumeMode || row.volume_mode || "default",
          temperatureMode: row.temperatureMode || row.temperature_mode || "default",
          volumeM: row.volumeM ?? row.volume_m ?? 1.0,
          volumeC: row.volumeC ?? row.volume_c ?? 0.0,
          temperatureM: row.temperatureM ?? row.temperature_m ?? 1.0,
          temperatureC_factor: row.temperatureC_factor ?? row.temperature_c ?? 0.0,
          isDisabled: !!(row.isDisabled ?? row.is_disabled),
          metrics: [
            {
              channel: String(row.volumeChannel ?? `CH${i * 2 + 1}`).trim(),
              type: "volume",
              unit: normalizeVolumeUnit(row.volumeUnit),
            },
            {
              channel: String(row.temperatureChannel ?? `CH${i * 2 + 2}`).trim(),
              type: "temperature",
              unit: normalizeTemperatureUnit(row.temperatureUnit),
            },
          ],
        }))
        : Array.from(
          { length: tanksCount },
          (_, i) => {
            const row = settingsRows[i];

            if (!row) {
              return {
                ...makeDefaultTank(i),
                capacityLiters: Number(tankCapacities[i]) || 1000,
              };
            }

            return {
              id: String(row.tankKey || row.id || `tank-${i + 1}`),
              name: String(row.tankName || row.name || row.tankKey || `Tank ${i + 1}`).trim(),
              capacityLiters:
                Number(row.capacityLiters) || Number(tankCapacities[i]) || 1000,
              variant: "rect",
              fluidColor: row.fluidColor || row.fluid_color,
              tempColor: row.tempColor || row.temp_color,
              disableVolume: !!(row.disableVolume ?? row.disable_volume),
              disableTemperature: !!(row.disableTemperature ?? row.disable_temperature),
              volumeMode: row.volumeMode || row.volume_mode || "default",
              temperatureMode: row.temperatureMode || row.temperature_mode || "default",
              volumeM: row.volumeM ?? row.volume_m ?? 1.0,
              volumeC: row.volumeC ?? row.volume_c ?? 0.0,
              temperatureM: row.temperatureM ?? row.temperature_m ?? 1.0,
              temperatureC_factor: row.temperatureC_factor ?? row.temperature_c ?? 0.0,
              isDisabled: !!(row.isDisabled ?? row.is_disabled),
              metrics: [
                {
                  channel: String(row.volumeChannel ?? `CH${i * 2 + 1}`).trim(),
                  type: "volume",
                  unit: normalizeVolumeUnit(row.volumeUnit),
                },
                {
                  channel: String(row.temperatureChannel ?? `CH${i * 2 + 2}`).trim(),
                  type: "temperature",
                  unit: normalizeTemperatureUnit(row.temperatureUnit),
                },
              ],
            };
          }
        );

      setSetupTanks(normalizedSetup);
      setAlarmMap(settingsJson?.alarms || {});
      setUserPermissions(settingsJson?.userPermissions || null);
      setSessionRole(settingsJson?.role || null);
      setInitialLoading(false);
    } catch (e) {
      console.error("Failed to load settings", e);
      setErr("Failed to load company settings");
      setInitialLoading(false);
    }
  }, [slug]);

  const loadData = useCallback(async () => {
    if (!slug || setupTanks.length === 0) return;

    const { influxOrg, influxBucket } = companyBranding;

    if (!influxOrg || !influxBucket) {
      setErr("Data source not configured. Please contact administrator.");
      setLoading(false);
      return;
    }

    try {
      const url = new URL("/api/influx/latest", window.location.origin);
      url.searchParams.set("org", influxOrg);
      url.searchParams.set("bucket", influxBucket);
      url.searchParams.set("slug", slug);

      const influxRes = await fetch(url.toString(), { cache: "no-store" });
      const influxJson = await influxRes.json().catch(() => ({}));

      if (!influxRes.ok) {
        throw new Error("Influx failed");
      }

      const rows = Array.isArray(influxJson?.rows) ? influxJson.rows : [];

      const mapped: Tank[] = setupTanks.map((cfg) => {
        const volumeMetric = cfg.metrics[0];
        const temperatureMetric = cfg.metrics[1];

        const volumeRow = rows.find(
          (r: any) => r.channel === volumeMetric.channel
        );

        const temperatureRow = rows.find(
          (r: any) => r.channel === temperatureMetric.channel
        );

        const volumeRaw = cfg.disableVolume ? undefined : toNumber(volumeRow?._value);
        let volumeLiters =
          volumeRaw !== undefined ? convertMaToLiters(volumeRaw, cfg.capacityLiters, cfg.volumeMode) : 0;

        // Apply calibration Y = MX + C
        if (volumeLiters !== undefined) {
          volumeLiters = (volumeLiters * (cfg.volumeM ?? 1.0)) + (cfg.volumeC ?? 0.0);
        }

        const temperatureRaw = cfg.disableTemperature ? undefined : toNumber(temperatureRow?._value);
        let temperatureC = undefined;
        if (temperatureRaw !== undefined) {
          if (cfg.temperatureMode === "percent") {
            temperatureC = temperatureRaw;
          } else if (cfg.temperatureMode === "inverted") {
            temperatureC = 100 - temperatureRaw;
          } else {
            temperatureC = convertTemperature(temperatureRaw, temperatureMetric.unit, "°C");
          }

          // Apply calibration Y = MX + C
          if (temperatureC !== undefined) {
            temperatureC = (temperatureC * (cfg.temperatureM ?? 1.0)) + (cfg.temperatureC_factor ?? 0.0);
          }
        }

        let hasData = false;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (!cfg.disableVolume && volumeRow?._time) {
          const pt = new Date(volumeRow._time).getTime();
          if (!Number.isNaN(pt) && Math.abs(now - pt) <= oneHour) hasData = true;
        }
        if (!hasData && !cfg.disableTemperature && temperatureRow?._time) {
          const pt = new Date(temperatureRow._time).getTime();
          if (!Number.isNaN(pt) && Math.abs(now - pt) <= oneHour) hasData = true;
        }

        const level =
          cfg.capacityLiters > 0 ? (volumeLiters / cfg.capacityLiters) * 100 : 0;

        const volumeValue = convertFromLiters(
          volumeLiters,
          volumeMetric.unit,
          cfg.capacityLiters
        );

        return {
          id: cfg.id,
          name: cfg.name,
          level: clamp(level, 0, 100),
          temperatureC,
          capacityLiters: cfg.capacityLiters,
          variant: "rect",
          volumeChannel: volumeMetric.channel,
          temperatureChannel: temperatureMetric.channel,
          volumeUnit: volumeMetric.unit,
          temperatureUnit: temperatureMetric.unit,
          hasData,
          fluidColor: cfg.fluidColor,
          tempColor: cfg.tempColor,
          disableVolume: cfg.disableVolume,
          disableTemperature: cfg.disableTemperature,
          isDisabled: cfg.isDisabled,
          volumeValue: Math.round(volumeValue * 100) / 100,
          temperatureValue:
            temperatureRaw !== undefined
              ? Math.round(temperatureRaw * 10) / 10
              : undefined,
          companySlug: slug,
          tankKey: cfg.id.includes("tank-") ? `Tank ${cfg.id.split("-")[1]}` : cfg.id, // Fallback to Tank X format if id is default
        };
      });

      setTanks(mapped);
      setLoading(false);
    } catch (e) {
      console.error("Failed to update live data", e);
      setErr("Failed to update live data");
      setLoading(false);
    }
  }, [slug, setupTanks, companyBranding]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (setupTanks.length > 0) {
      loadData();
    }
  }, [setupTanks, loadData]);

  useVisibilityPolling(() => {
    loadData();
    loadSettings();
  }, 10000);

  useEffect(() => {
    if (!err) return;

    const timer = setTimeout(() => setErr(""), 3000);
    return () => clearTimeout(timer);
  }, [err]);

  if (initialLoading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white animate-spin" />
          <div className="text-white/40 text-sm font-medium tracking-widest uppercase">Loading Dashboard</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white/10">
      <BackgroundFX />

      <div className="relative">
        <TopHero
          brand="Ekatva"
          hideViewTanks
          navItems={[
            ...(sessionRole === "admin" || sessionRole === "company" || (userPermissions && userPermissions.some(p => p.accessLevel === "edit")) ? [{ label: "Setup", href: `/company/${slug}/setup` }] : []),
            { label: "Dashboard", href: `/company/${slug}/dashboard` },
            { label: "About", href: "https://ekatvatechnovation.com/" },
          ]}
        />

        <section id="tanks" className="mx-auto max-w-[1400px] px-6 pb-20 pt-6">
          {err ? (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {err}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] items-start gap-8">
            {/* Sidebar Left: Branding + Alarms */}
            <div className="space-y-6 lg:sticky lg:top-6">
              {/* Company Branding */}
              <div className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col items-center text-center">
                  {companyBranding.logoUrl ? (
                    <img src={companyBranding.logoUrl} alt={companyBranding.name} className="h-20 w-auto object-contain mb-4" />
                  ) : null}
                  <h1 className="text-2xl font-bold text-black dark:text-white">{companyBranding.name}</h1>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.2em] opacity-50">Industrial Monitoring</div>
                </div>
              </div>

              {/* Active Alarms */}
              <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-black dark:text-white md:text-xl">Active Alarms</h2>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/55">Latest notifications.</p>
                </div>

                {alarms.length > 0 ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-50 p-4 backdrop-blur-xl dark:bg-red-500/10">
                    <div className="space-y-3 text-xs text-black/70 dark:text-white/70">
                      {alarms.map((a, i) => (
                        <div key={`${a.tankId}-${i}`} className="flex flex-col gap-1 border-b border-black/10 pb-3 last:border-b-0 last:pb-0 dark:border-white/10">
                          <div className="text-black/90 dark:text-white/90">
                            <span className="font-semibold">{a.tankName}</span>{" "}
                            <span className="text-red-600 dark:text-red-300">— {a.reason}</span>
                          </div>
                          <div className="text-black/55 dark:text-white/55">
                            Value: {typeof a.volumeL === "number" ? a.volumeL.toFixed(4) : "--"} •
                            Temp: {typeof a.temperatureC === "number" ? `${a.temperatureC.toFixed(2)}°C` : "--"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/10 bg-white/50 p-6 text-center text-sm text-black/55 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                    No active alarms.
                  </div>
                )}
              </div>

              {/* Alarm History */}
              <AlarmHistory slug={slug} />
            </div>

            {/* Main Content: Live Tanks */}
            <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 min-w-0 overflow-hidden">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-black dark:text-white md:text-2xl">Live Tanks</h2>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/55">Real-time status from InfluxDB channels.</p>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">{loading ? "Loading…" : "Updated every 10s"}</div>
              </div>

              <TankGrid
                tanks={tanks}
                loading={loading}
                alarmMap={alarmMap}
                userPermissions={userPermissions}
                onAlarmList={setAlarms}
                onOpenTank={(t) => setOpenTankId(String(t.id))}
              />
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