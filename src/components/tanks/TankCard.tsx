"use client";

import { useEffect, useMemo, useState } from "react";
import FluidTank from "./FluidTankClient";
import type { TankAlarmLimits } from "@/types/alarm";
import { type VolumeUnit, type TemperatureUnit } from "@/lib/conversions";

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
  fluidColor?: string;
  tempColor?: string;
  disableVolume?: boolean;
  disableTemperature?: boolean;
  isDisabled?: boolean;
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
  fluidColor,
  tempColor,
  disableVolume,
  disableTemperature,
  isDisabled,
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

    if (!disableVolume && typeof limits.minVolumeL === "number" && nowVol < limits.minVolumeL) {
      reasons.push("Low Volume");
    }

    if (!disableVolume && typeof limits.maxVolumeL === "number" && nowVol > limits.maxVolumeL) {
      reasons.push("High Volume");
    }

    if (
      !disableTemperature &&
      typeof limits.minTempC === "number" &&
      typeof temperatureC === "number" &&
      temperatureC < limits.minTempC
    ) {
      reasons.push("Low Temp");
    }

    if (
      !disableTemperature &&
      typeof limits.maxTempC === "number" &&
      typeof temperatureC === "number" &&
      temperatureC > limits.maxTempC
    ) {
      reasons.push("High Temp");
    }

    return reasons;
  }, [limits, nowVol, temperatureC, disableVolume, disableTemperature]);

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
        "w-full min-w-0 rounded-3xl border p-5 text-left shadow-xl backdrop-blur transition",
        "overflow-visible",
        isDisabled
          ? "cursor-pointer border-black/10 bg-black/5 opacity-60 grayscale hover:opacity-80 dark:border-white/10 dark:bg-white/5"
          : resolvedAlarmActive
            ? "border-red-500/50 bg-red-500/10 ring-1 ring-red-500/20 shadow-red-950/30 hover:bg-red-500/15"
            : "border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8",
      ].join(" ")}
    >
      <div className="mb-5 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold text-black dark:text-white" title={name}>
            {name}
          </h2>

          {!disableTemperature && (
            <p className="mt-2 text-base text-black/60 dark:text-white/60" suppressHydrationWarning>
              Temp: {tempText}
              {temperatureUnit}
            </p>
          )}

          <p
            className={
              resolvedAlarmActive
                ? "mt-1 text-base text-red-600 dark:text-red-200"
                : "mt-1 text-base text-black/45 dark:text-white/45"
            }
          >
            {resolvedAlarmLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${isDisabled
              ? "bg-black/20 dark:bg-white/20"
              : !hasData
                ? "bg-red-500"
                : resolvedAlarmActive
                  ? "animate-pulse bg-red-500"
                  : "bg-emerald-500"
              }`}
          />

          <span
            className={`text-sm font-bold tracking-wide ${isDisabled
              ? "text-black/40 dark:text-white/40"
              : !hasData
                ? "text-red-500"
                : resolvedAlarmActive
                  ? "text-red-500"
                  : "text-emerald-500"
              }`}
          >
            {isDisabled ? "Offline" : !hasData ? "Disconnected" : resolvedAlarmActive ? "Alarm" : "Live"}
          </span>
        </div>
      </div>

      <div className="flex w-full min-w-0 justify-center">
        {isDisabled || (disableVolume && disableTemperature) ? (
          <div className="flex h-[260px] w-full items-center justify-center text-sm font-medium italic opacity-50">
            {isDisabled ? "Disabled" : "No Metrics"}
          </div>
        ) : (
          <div className="w-full max-w-[420px] min-w-0">
            <FluidTank
              level={disableVolume ? 50 : levelPercent}
              capacityLiters={capacityLiters ?? 1000}
              variant={variant}
              alarm={resolvedAlarmActive}
              surface="flat"
              displayValue={
                disableVolume
                  ? typeof temperatureValue === "number"
                    ? temperatureValue
                    : 0
                  : displayVolume
              }
              displayUnit={disableVolume ? temperatureUnit : volumeUnit}
              accent={disableVolume ? "temperature" : "volume"}
              fluidColor={disableVolume ? tempColor : fluidColor}
            />
          </div>
        )}
      </div>
    </button>
  );
}