"use client";

import { useEffect, useMemo, useState } from "react";
import FluidTank from "./FluidTankClient";
import type { TankAlarmLimits } from "@/types/alarm";
import type { VolumeUnit, TemperatureUnit } from "@/lib/companySetupClient";

type TankCardProps = {
  id?: string;
  name: string;
  level: number;
  variant?: "rect" | "cylinder";
  temperatureC?: number;
  capacityLiters?: number;
  limits?: TankAlarmLimits;
  onOpen?: () => void;
  volumeValue?: number;
  volumeUnit?: VolumeUnit;
  temperatureValue?: number;
  temperatureUnit?: TemperatureUnit;
  alarmActive?: boolean;
  alarmLabel?: string;
  hasData?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function TankCard({
  name,
  level,
  variant = "rect",
  temperatureC,
  capacityLiters,
  limits,
  onOpen,
  volumeValue,
  volumeUnit = "L",
  temperatureValue,
  temperatureUnit = "°C",
  alarmActive,
  alarmLabel,
  hasData = true,
}: TankCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const tempText = useMemo(() => {
    if (!mounted) return "--";

    if (typeof temperatureValue === "number" && Number.isFinite(temperatureValue)) {
      return temperatureValue.toFixed(1);
    }

    if (typeof temperatureC !== "number" || Number.isNaN(temperatureC)) {
      return "--";
    }

    return temperatureC.toFixed(1);
  }, [mounted, temperatureValue, temperatureC]);

  const levelPercent = useMemo(() => {
    if (level <= 100) {
      return clamp(level, 0, 100);
    }

    const cap = capacityLiters ?? 1000;
    return clamp((level / cap) * 100, 0, 100);
  }, [level, capacityLiters]);

  const nowVol = useMemo(() => {
    const cap = capacityLiters ?? 1000;
    return Math.round((levelPercent / 100) * cap);
  }, [levelPercent, capacityLiters]);

  const displayVolume = useMemo(() => {
    if (typeof volumeValue === "number" && Number.isFinite(volumeValue)) {
      return volumeValue;
    }
    return nowVol;
  }, [volumeValue, nowVol]);

  const fallbackAlarmReasons = useMemo(() => {
    const reasons: string[] = [];

    if (!limits) return reasons;

    if (typeof limits.minVolumeL === "number" && nowVol < limits.minVolumeL) {
      reasons.push("Low Volume");
    }

    if (typeof limits.maxVolumeL === "number" && nowVol > limits.maxVolumeL) {
      reasons.push("High Volume");
    }

    if (
      typeof limits.minTempC === "number" &&
      typeof temperatureC === "number" &&
      temperatureC < limits.minTempC
    ) {
      reasons.push("Low Temp");
    }

    if (
      typeof limits.maxTempC === "number" &&
      typeof temperatureC === "number" &&
      temperatureC > limits.maxTempC
    ) {
      reasons.push("High Temp");
    }

    return reasons;
  }, [limits, nowVol, temperatureC]);

  const resolvedAlarmActive =
    typeof alarmActive === "boolean" ? alarmActive : fallbackAlarmReasons.length > 0;

  const resolvedAlarmLabel =
    typeof alarmLabel === "string"
      ? alarmLabel
      : resolvedAlarmActive
      ? fallbackAlarmReasons.join(", ")
      : "Within limits";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "w-full rounded-2xl border p-4 text-left shadow-lg backdrop-blur transition",
        resolvedAlarmActive
          ? "border-red-500/50 bg-red-50 dark:bg-red-500/10 ring-1 ring-red-500/20 shadow-red-900/10 dark:shadow-red-950/30 hover:bg-red-100 dark:hover:bg-red-500/12"
          : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/8",
      ].join(" ")}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-black dark:text-white">{name}</h2>

          <p className="mt-0.5 text-xs text-black/60 dark:text-white/60" suppressHydrationWarning>
            Temp: {tempText}
            {temperatureUnit}
          </p>

          <p
            className={
              resolvedAlarmActive
                ? "mt-0.5 text-xs text-red-600 dark:text-red-200"
                : "mt-0.5 text-xs text-black/45 dark:text-white/45"
            }
          >
            {resolvedAlarmLabel}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              !hasData
                ? "bg-red-500"
                : resolvedAlarmActive
                ? "bg-red-500 animate-pulse"
                : "bg-emerald-500"
            }`}
          />
          <span
            className={`text-[10px] font-semibold tracking-wide ${
              !hasData
                ? "text-red-500"
                : resolvedAlarmActive
                ? "text-red-500"
                : "text-emerald-500"
            }`}
          >
            {!hasData ? "Disconnected" : resolvedAlarmActive ? "Alarm" : "Live"}
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <FluidTank
          level={levelPercent}
          capacityLiters={capacityLiters ?? 1000}
          variant={variant}
          alarm={resolvedAlarmActive}
          surface="flat"
          displayValue={displayVolume}
          displayUnit={volumeUnit}
          accent="volume"
        />
      </div>
    </button>
  );
}
