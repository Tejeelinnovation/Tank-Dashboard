"use client";

import * as React from "react";
import TankCard from "./TankCard";
import type { TankAlarmLimits } from "@/types/alarm";
import type { VolumeUnit, TemperatureUnit } from "@/lib/companySetupClient";

export type Tank = {
  id: string;
  name: string;
  level: number;
  temperatureC?: number;
  capacityLiters?: number;
  variant?: "rect" | "cylinder";
  volumeChannel?: string;
  temperatureChannel?: string;
  volumeUnit?: VolumeUnit;
  temperatureUnit?: TemperatureUnit;
  volumeValue?: number;
  temperatureValue?: number;
};

type TankGridProps = {
  tanks?: Tank[];
  title?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
  onOpenTank?: (tank: Tank) => void;
  onAlarmList?: (events: AlarmEvent[]) => void;
  alarmMap?: Record<string, TankAlarmLimits>;
};

export type AlarmEvent = {
  tankId: string;
  tankName: string;
  timeIso: string;
  temperatureC?: number;
  volumeL?: number;
  reason: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function extractTankIndex(value?: string) {
  if (!value) return undefined;
  const m =
    String(value).match(/(?:tank\s*[-_ ]*|^t)(\d+)$/i) ??
    String(value).match(/(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeKey(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickLimits(map: Record<string, TankAlarmLimits>, tank: Tank) {
  const directKeys = [tank.id, tank.name].filter(Boolean) as string[];

  for (const key of directKeys) {
    if (map[key]) return map[key];
  }

  const wantedNormalized = new Set(directKeys.map(normalizeKey).filter(Boolean));
  const wantedIndex = extractTankIndex(tank.id) ?? extractTankIndex(tank.name);

  for (const [key, limits] of Object.entries(map)) {
    if (!limits) continue;

    if (wantedNormalized.has(normalizeKey(key))) return limits;

    const entryIndex = extractTankIndex(key);
    if (
      typeof wantedIndex === "number" &&
      typeof entryIndex === "number" &&
      wantedIndex === entryIndex
    ) {
      return limits;
    }
  }

  return undefined;
}

function normalizeLevelPercent(tank: Tank) {
  const raw = safeNum(tank.level, 0);

  if (raw <= 100) {
    return clamp(raw, 0, 100);
  }

  const cap =
    typeof tank.capacityLiters === "number" && tank.capacityLiters > 0
      ? tank.capacityLiters
      : 1000;

  return clamp((raw / cap) * 100, 0, 100);
}

function currentVolumeL(tank: Tank) {
  const cap =
    typeof tank.capacityLiters === "number" && tank.capacityLiters > 0
      ? tank.capacityLiters
      : 1000;

  const pct = normalizeLevelPercent(tank);
  return Math.round((pct / 100) * cap);
}

function getAlarmReasons(tank: Tank, limits?: TankAlarmLimits) {
  if (!limits) return [] as string[];

  const reasons: string[] = [];
  const vol = currentVolumeL(tank);
  const temp =
    typeof tank.temperatureC === "number" ? Math.round(tank.temperatureC * 10) / 10 : undefined;

  if (typeof limits.minVolumeL === "number" && vol < limits.minVolumeL) {
    reasons.push("Low Volume");
  }
  if (typeof limits.maxVolumeL === "number" && vol > limits.maxVolumeL) {
    reasons.push("High Volume");
  }
  if (typeof limits.minTempC === "number" && typeof temp === "number" && temp < limits.minTempC) {
    reasons.push("Low Temp");
  }
  if (typeof limits.maxTempC === "number" && typeof temp === "number" && temp > limits.maxTempC) {
    reasons.push("High Temp");
  }

  return reasons;
}

export default function TankGrid({
  tanks = [],
  title,
  loading = false,
  disabled = false,
  emptyText = "No tank data available",
  onOpenTank,
  onAlarmList,
  alarmMap = {},
}: TankGridProps) {
  const normalizedTanks = React.useMemo(() => {
    return tanks.map((tank, idx) => {
      const id = String(tank.id ?? `T${idx + 1}`);
      const name = String(tank.name ?? `Tank ${idx + 1}`);

      const rawLevel = safeNum(tank.level, 0);
      const temperatureC =
        tank.temperatureC === undefined || tank.temperatureC === null
          ? undefined
          : Math.round(safeNum(tank.temperatureC, 0) * 10) / 10;

      const capacityLiters =
        tank.capacityLiters === undefined || tank.capacityLiters === null
          ? undefined
          : Math.max(0, Math.round(safeNum(tank.capacityLiters, 0)));

      return {
        ...tank,
        id,
        name,
        level: rawLevel,
        temperatureC,
        capacityLiters,
        variant: "rect",
      } as Tank;
    });
  }, [tanks]);

  const alarmEvents = React.useMemo(() => {
    const events: AlarmEvent[] = [];

    for (const t of normalizedTanks) {
      const limits = pickLimits(alarmMap, t);
      const reasons = getAlarmReasons(t, limits);

      if (reasons.length > 0) {
        events.push({
          tankId: t.id,
          tankName: t.name,
          timeIso: new Date().toISOString(),
          temperatureC: t.temperatureC,
          volumeL: currentVolumeL(t),
          reason: reasons.join(", "),
        });
      }
    }

    return events;
  }, [normalizedTanks, alarmMap]);

  const lastAlarmSignatureRef = React.useRef("");

React.useEffect(() => {
  if (!onAlarmList) return;

  const sig = JSON.stringify(
    alarmEvents.map((a) => ({
      tankId: a.tankId,
      reason: a.reason,
      volumeL: a.volumeL,
      temperatureC: a.temperatureC,
    }))
  );

  if (lastAlarmSignatureRef.current === sig) return;

  lastAlarmSignatureRef.current = sig;
  onAlarmList(alarmEvents);
}, [alarmEvents, onAlarmList]);


  if (disabled) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-base font-semibold text-white">Dashboard Disabled</div>
        <div className="mt-1 text-sm text-white/60">Contact admin to enable data access.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
        Loading tanks...
      </div>
    );
  }

  if (!tanks || tanks.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
        {emptyText}
      </div>
    );
  }

  return (
    <div>
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {normalizedTanks.map((tank) => {
          const limits = pickLimits(alarmMap, tank);
          const levelPercent = normalizeLevelPercent(tank);
          const alarmReasons = getAlarmReasons(tank, limits);
          const alarmActive = alarmReasons.length > 0;

          return (
            <TankCard
              key={tank.id}
              id={tank.id}
              name={tank.name}
              level={levelPercent}
              temperatureC={tank.temperatureC}
              capacityLiters={tank.capacityLiters}
              variant="rect"
              limits={limits}
              volumeValue={tank.volumeValue}
              volumeUnit={tank.volumeUnit}
              temperatureValue={tank.temperatureValue}
              temperatureUnit={tank.temperatureUnit}
              alarmActive={alarmActive}
              alarmLabel={alarmActive ? alarmReasons.join(", ") : "Within limits"}
              onOpen={onOpenTank ? () => onOpenTank(tank) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
