"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

  async function load() {
    if (!slug) return;

    setErr("");

    try {
      const settingsRes = await fetch(
  `/api/company/settings?slug=${encodeURIComponent(slug)}`,
  {
    cache: "no-store",
  }
);
      const settingsJson = await settingsRes.json().catch(() => ({}));

      if (!settingsRes.ok || !settingsJson?.ok) {
        setErr(settingsJson?.error || "Failed to load company settings");
        setTanks([]);
        setSetupTanks([]);
        setAlarmMap({});
        return;
      }

      const tanksCount = clamp(
        Number(
          settingsJson?.company?.tanks_count ??
            settingsJson?.company?.tanksCount ??
            4
        ),
        1,
        20
      );

      const tankCapacities = Array.isArray(settingsJson?.company?.tank_capacities)
        ? settingsJson.company.tank_capacities
        : Array.isArray(settingsJson?.company?.tankCapacities)
        ? settingsJson.company.tankCapacities
        : [];

      const settingsRows = Array.isArray(settingsJson?.tanks)
        ? settingsJson.tanks
        : [];

      const normalizedSetup: TankSetupItem[] = Array.from(
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
            id: String(row.id ?? `tank-${i + 1}`),
            name: String(
              row.tank_name ?? row.name ?? `Tank ${i + 1}`
            ).trim(),
            capacityLiters:
              Number(row.capacity_liters ?? row.capacityLiters) ||
              Number(tankCapacities[i]) ||
              1000,
            variant: "rect",
            metrics: [
              {
                channel: String(
                  row.volume_channel ?? row.volumeChannel ?? `CH${i * 2 + 1}`
                ).trim(),
                type: "volume",
                unit: (String(
                  row.volume_unit ?? row.volumeUnit ?? "L"
                ).trim() || "L") as VolumeUnit,
              },
              {
                channel: String(
                  row.temperature_channel ??
                    row.temperatureChannel ??
                    `CH${i * 2 + 2}`
                ).trim(),
                type: "temperature",
                unit: (String(
                  row.temperature_unit ?? row.temperatureUnit ?? "°C"
                ).trim() || "°C") as TemperatureUnit,
              },
            ],
          };
        }
      );

      setSetupTanks(normalizedSetup);
      setAlarmMap(
        settingsJson?.alarms && typeof settingsJson.alarms === "object"
          ? settingsJson.alarms
          : {}
      );

      const influxRes = await fetch("/api/influx/latest", { cache: "no-store" });
      const influxJson = await influxRes.json().catch(() => ({}));

      if (!influxRes.ok) {
        setErr(influxJson?.error || "Failed to load Influx data");
        setTanks([]);
        return;
      }

      const rows = Array.isArray(influxJson?.rows) ? influxJson.rows : [];

      const mapped: Tank[] = normalizedSetup.map((cfg) => {
        const volumeMetric = cfg.metrics[0];
        const temperatureMetric = cfg.metrics[1];

        const volumeRow = rows.find((r: any) => r.channel === volumeMetric.channel);
        const temperatureRow = rows.find(
          (r: any) => r.channel === temperatureMetric.channel
        );

        const volumeRaw = toNumber(volumeRow?._value);
        const temperatureRaw = toNumber(temperatureRow?._value);

        const volumeLiters =
          volumeRaw !== undefined
            ? convertVolumeToLiters(
                volumeRaw,
                volumeMetric.unit,
                cfg.capacityLiters
              )
            : 0;

        const level =
          volumeRaw !== undefined
            ? getVolumePercent(
                volumeRaw,
                volumeMetric.unit,
                cfg.capacityLiters
              )
            : 0;

        const temperatureC =
          temperatureRaw !== undefined
            ? convertTemperatureToC(temperatureRaw, temperatureMetric.unit)
            : undefined;

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
          volumeValue:
            volumeRaw !== undefined
              ? Math.round(volumeRaw * 100) / 100
              : Math.round(volumeLiters),
          temperatureValue:
            temperatureRaw !== undefined
              ? Math.round(temperatureRaw * 10) / 10
              : undefined,
        };
      });

      setTanks(mapped);
    } catch {
      setErr("Network error");
      setTanks([]);
      setSetupTanks([]);
      setAlarmMap({});
    } finally {
      setLoading(false);
    }
  }

  async function logoutCompany() {
    await fetch("/api/company/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!slug) return;

    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [slug]);

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <BackgroundFX />

      <div className="relative">
        <TopHero
          brand="Tankco."
          // ctaLabel="Logout"
          // onCtaClickHref="/login"
          eyebrow="COMPANY DASHBOARD"
          titleLine1="Tank"
          titleLine2="Dashboard"
          subtitle="Live values from InfluxDB using fixed volume and temperature channels configured by the admin."
          // navItems={[
          //   { label: "Setup", href: `/company/${slug}/setup` },
          // ]}
        />

        {/* <div className="mx-auto -mt-6 max-w-6xl px-6">
          <button
            onClick={logoutCompany}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
          >
            Logout
          </button>
        </div> */}

        <section id="tanks" className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white md:text-2xl">
                Live Tanks
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Showing current configured volume and temperature channels from InfluxDB.
              </p>
            </div>

            <div className="text-xs text-white/50">
              {loading ? "Loading…" : "Updated every 15s"}
            </div>
          </div>

          {err ? (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          ) : null}

          {alarms.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 backdrop-blur-xl">
              <div className="text-sm font-semibold text-red-200">Alarm Events</div>
              <div className="mt-2 space-y-2 text-xs text-white/70">
                {alarms.map((a, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="text-white/90">
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
          ) : null}

          <div className="mt-6">
            <TankGrid
              tanks={tanks}
              loading={loading}
              alarmMap={alarmMap}
              onAlarmList={setAlarms}
              onOpenTank={(t) => setOpenTankId(String(t.id))}
            />
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