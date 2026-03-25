"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import TankGrid, { type AlarmEvent, type Tank } from "./TankGrid";
import TankDetailsModal from "./TankDetailsModal";
import type { TankAlarmLimits } from "@/types/alarm";
import type {
  TankSetupItem,
  VolumeUnit,
  TemperatureUnit,
} from "@/lib/companySetupClient";

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

export default function TankDashboardLive() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [loading, setLoading] = React.useState(true);
  const [tanks, setTanks] = React.useState<Tank[]>([]);
  const [selectedTank, setSelectedTank] = React.useState<Tank | null>(null);
  const [alarmMap, setAlarmMap] = React.useState<Record<string, TankAlarmLimits>>(
    {}
  );
  const [alarmEvents, setAlarmEvents] = React.useState<AlarmEvent[]>([]);

  const loadAll = React.useCallback(async () => {
    if (!slug) return;

    try {
      setLoading(true);

      const settingsRes = await fetch(
  `/api/company/settings?slug=${encodeURIComponent(slug)}`,
  {
    cache: "no-store",
  }
);
      const settingsJson = await settingsRes.json().catch(() => ({}));

      if (!settingsRes.ok || !settingsJson?.ok) {
        throw new Error(settingsJson?.error || "Failed to load company settings");
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

      const setupTanks: TankSetupItem[] = Array.from({ length: tanksCount }, (_, i) => {
        const row = settingsRows[i];

        if (!row) {
          return {
            ...makeDefaultTank(i),
            capacityLiters: Number(tankCapacities[i]) || 1000,
          };
        }

        return {
          id: String(row.id ?? `tank-${i + 1}`),
          name: String(row.tank_name ?? row.name ?? `Tank ${i + 1}`).trim(),
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
      });

      const influxRes = await fetch("/api/influx/latest", { cache: "no-store" });
      const influxJson = await influxRes.json().catch(() => ({}));

      if (!influxRes.ok) {
        throw new Error(influxJson?.error || "Failed to load Influx data");
      }

      const rows = Array.isArray(influxJson?.rows) ? influxJson.rows : [];

      const mapped: Tank[] = setupTanks.map((cfg: TankSetupItem) => {
        const volumeMetric = cfg.metrics[0];
        const temperatureMetric = cfg.metrics[1];

        const volumeRow = rows.find((r: any) => r.channel === volumeMetric.channel);
        const temperatureRow = rows.find(
          (r: any) => r.channel === temperatureMetric.channel
        );

        const volumeRaw = toNumber(volumeRow?._value);
        const temperatureRaw = toNumber(temperatureRow?._value);
        
        const hasData = volumeRaw !== undefined;

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
          hasData,
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
      setAlarmMap(
        settingsJson?.alarms && typeof settingsJson.alarms === "object"
          ? settingsJson.alarms
          : {}
      );
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setTanks([]);
      setAlarmMap({});
    } finally {
      setLoading(false);
    }
  }, [slug]);

  React.useEffect(() => {
    if (!slug) return;

    loadAll();
    const interval = window.setInterval(loadAll, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [slug, loadAll]);

  return (
    <>
      <TankGrid
        tanks={tanks}
        loading={loading}
        alarmMap={alarmMap}
        onOpenTank={(tank) => setSelectedTank(tank)}
        onAlarmList={setAlarmEvents}
      />

      <TankDetailsModal
        open={!!selectedTank}
        onClose={() => setSelectedTank(null)}
        tank={selectedTank}
        alarmMap={alarmMap}
      />

      {alarmEvents.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-sm font-semibold text-white">Active alarms</div>
          <div className="mt-3 space-y-2">
            {alarmEvents.slice(0, 8).map((a) => (
              <div
                key={`${a.tankId}-${a.timeIso}-${a.reason}`}
                className="rounded-xl border border-red-500/20 bg-black/20 px-3 py-2 text-sm text-white/85"
              >
                <span className="font-medium">{a.tankName}</span>
                <span className="mx-2 text-white/30">•</span>
                {a.reason}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}