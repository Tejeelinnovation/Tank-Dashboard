"use client";

import * as React from "react";
import TankCard from "./TankCard";
import type { TankAlarmLimits } from "@/types/alarm";
import type { VolumeUnit, TemperatureUnit, MetricMode } from "@/lib/conversions";

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
  hasData?: boolean;
  volumeValue?: number;
  temperatureValue?: number;
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
  companySlug?: string;
  tankKey?: string;
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

import {
  pickAlarmLimits as pickLimits,
  getTankAlarmReasons as getAlarmReasons,
  normalizeLevelPercent,
  currentVolumeL
} from "@/lib/alarm";

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
        hasData: tank.hasData,
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
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-8 text-center transition-colors">
        <div className="text-base font-semibold text-black dark:text-white">Dashboard Disabled</div>
        <div className="mt-1 text-sm text-black/60 dark:text-white/60">Contact admin to enable data access.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-8 text-center text-black/60 dark:text-white/60 transition-colors">
        Loading tanks...
      </div>
    );
  }

  if (!tanks || tanks.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-8 text-center text-black/60 dark:text-white/60 transition-colors">
        {emptyText}
      </div>
    );
  }

  return (
    <div>
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-black dark:text-white">{title}</h2>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
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
              hasData={tank.hasData}
              fluidColor={tank.fluidColor}
              tempColor={tank.tempColor}
              disableVolume={tank.disableVolume}
              disableTemperature={tank.disableTemperature}
              onOpen={onOpenTank ? () => onOpenTank(tank) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
