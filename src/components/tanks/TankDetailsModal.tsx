"use client";

import React from "react";
import FluidTank from "./FluidTankClient";
import TankHistoryChart from "./TankHistoryChart";
import type { Tank } from "./TankGrid";
import type { TankAlarmLimits } from "@/types/alarm";
import {
  litersToVolumeUnit,
  cToTemperatureUnit,
  type VolumeUnit,
  type TemperatureUnit,
} from "@/lib/companySetupClient";

type TankMetric = "volume" | "temperature";

type ChartPoint = {
  date: string;
  value: number;
  alarm: boolean;
};

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(v: string) {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function pickLimits(
  map: Record<string, TankAlarmLimits>,
  tank: Pick<Tank, "id" | "name">
) {
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

function normalizeLevelPercent(tank: Tank | null) {
  if (!tank) return 0;

  const raw = Number(tank.level);
  if (!Number.isFinite(raw)) return 0;

  if (raw <= 100) {
    return clamp(raw, 0, 100);
  }

  const cap =
    typeof tank.capacityLiters === "number" && tank.capacityLiters > 0
      ? tank.capacityLiters
      : 1000;

  return clamp((raw / cap) * 100, 0, 100);
}

function currentVolumeL(tank: Tank | null) {
  if (!tank) return 0;

  const cap =
    typeof tank.capacityLiters === "number" && tank.capacityLiters > 0
      ? tank.capacityLiters
      : 1000;

  const pct = normalizeLevelPercent(tank);
  return Math.round((pct / 100) * cap);
}

function convertVolumeRawToLiters(
  rawValue: number,
  unit: VolumeUnit | undefined,
  capacityLiters: number
) {
  if (!Number.isFinite(rawValue)) return 0;
  if (unit === "%") return (rawValue / 100) * capacityLiters;
  if (unit === "m³") return rawValue * 1000;
  return rawValue;
}

function convertTemperatureRawToC(
  rawValue: number,
  unit: TemperatureUnit | undefined
) {
  if (!Number.isFinite(rawValue)) return 0;
  if (unit === "°F") return ((rawValue - 32) * 5) / 9;
  return rawValue;
}

function temperatureToVisualLevel(tempC?: number) {
  if (typeof tempC !== "number" || !Number.isFinite(tempC)) return 0;
  const min = -10;
  const max = 80;
  return Math.max(0, Math.min(100, ((tempC - min) / (max - min)) * 100));
}

function roundForUnit(value: number, unitLabel: string) {
  if (!Number.isFinite(value)) return 0;
  if (unitLabel === "m³") return Math.round(value * 100) / 100;
  if (unitLabel === "%" || unitLabel === "°C" || unitLabel === "°F") {
    return Math.round(value * 10) / 10;
  }
  return Math.round(value);
}

export default function TankDetailsModal({
  open,
  onClose,
  tank,
  alarmMap,
}: {
  open: boolean;
  onClose: () => void;
  tank: Tank | null;
  alarmMap: Record<string, TankAlarmLimits>;
}) {
  const tankId = tank?.id ?? "";
  const tankName = tank?.name ?? "";

  const [metric, setMetric] = React.useState<TankMetric>("volume");
  const [history, setHistory] = React.useState<ChartPoint[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState("");

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const defaultStart = React.useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return d;
  }, [today]);

  const [startStr, setStartStr] = React.useState(toDateInputValue(defaultStart));
  const [endStr, setEndStr] = React.useState(toDateInputValue(today));

  React.useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    setMetric("volume");
    setStartStr(toDateInputValue(defaultStart));
    setEndStr(toDateInputValue(today));
  }, [open, tankId, defaultStart, today]);

  const limits = React.useMemo(() => {
    if (!tank) return undefined;
    return pickLimits(alarmMap, tank);
  }, [tank, alarmMap]);

  const currentVolumeLiters = React.useMemo(() => currentVolumeL(tank), [tank]);

  const volumeAlarmNow = React.useMemo(() => {
    if (!tank || !limits) return false;

    if (
      typeof limits.minVolumeL === "number" &&
      currentVolumeLiters < limits.minVolumeL
    ) {
      return true;
    }

    if (
      typeof limits.maxVolumeL === "number" &&
      currentVolumeLiters > limits.maxVolumeL
    ) {
      return true;
    }

    return false;
  }, [tank, limits, currentVolumeLiters]);

  const temperatureAlarmNow = React.useMemo(() => {
    if (!tank || !limits || typeof tank.temperatureC !== "number") return false;

    if (
      typeof limits.minTempC === "number" &&
      tank.temperatureC < limits.minTempC
    ) {
      return true;
    }

    if (
      typeof limits.maxTempC === "number" &&
      tank.temperatureC > limits.maxTempC
    ) {
      return true;
    }

    return false;
  }, [tank, limits]);

  const alarmNow = volumeAlarmNow || temperatureAlarmNow;

  const alarmReasons = React.useMemo(() => {
    const reasons: string[] = [];

    if (volumeAlarmNow) {
      if (
        typeof limits?.minVolumeL === "number" &&
        currentVolumeLiters < limits.minVolumeL
      ) {
        reasons.push("Low Volume");
      }
      if (
        typeof limits?.maxVolumeL === "number" &&
        currentVolumeLiters > limits.maxVolumeL
      ) {
        reasons.push("High Volume");
      }
    }

    if (temperatureAlarmNow) {
      if (
        typeof limits?.minTempC === "number" &&
        typeof tank?.temperatureC === "number" &&
        tank.temperatureC < limits.minTempC
      ) {
        reasons.push("Low Temp");
      }
      if (
        typeof limits?.maxTempC === "number" &&
        typeof tank?.temperatureC === "number" &&
        tank.temperatureC > limits.maxTempC
      ) {
        reasons.push("High Temp");
      }
    }

    return reasons;
  }, [volumeAlarmNow, temperatureAlarmNow, limits, currentVolumeLiters, tank]);

  const selectedDisplay = React.useMemo(() => {
    if (!tank) {
      return {
        label: "L",
        value: 0,
        visualLevel: 0,
        accent: "volume" as const,
      };
    }

    if (metric === "volume") {
      const label = tank.volumeUnit ?? "L";
      const value =
        typeof tank.volumeValue === "number"
          ? tank.volumeValue
          : roundForUnit(
              litersToVolumeUnit(
                currentVolumeLiters,
                { capacityLiters: tank.capacityLiters ?? 1000 },
                label
              ),
              label
            );

      return {
        label,
        value,
        visualLevel: normalizeLevelPercent(tank),
        accent: "volume" as const,
      };
    }

    const label = tank.temperatureUnit ?? "°C";
    const value =
      typeof tank.temperatureValue === "number"
        ? tank.temperatureValue
        : roundForUnit(cToTemperatureUnit(tank.temperatureC ?? 0, label), label);

    return {
      label,
      value,
      visualLevel: temperatureToVisualLevel(tank.temperatureC),
      accent: "temperature" as const,
    };
  }, [tank, metric, currentVolumeLiters]);

  const thresholdLines = React.useMemo(() => {
    if (!tank || !limits) return {};

    if (metric === "volume") {
      const unit = tank.volumeUnit ?? "L";
      return {
        min:
          typeof limits.minVolumeL === "number"
            ? roundForUnit(
                litersToVolumeUnit(
                  limits.minVolumeL,
                  { capacityLiters: tank.capacityLiters ?? 1000 },
                  unit
                ),
                unit
              )
            : undefined,
        max:
          typeof limits.maxVolumeL === "number"
            ? roundForUnit(
                litersToVolumeUnit(
                  limits.maxVolumeL,
                  { capacityLiters: tank.capacityLiters ?? 1000 },
                  unit
                ),
                unit
              )
            : undefined,
      };
    }

    const unit = tank.temperatureUnit ?? "°C";
    return {
      min:
        typeof limits.minTempC === "number"
          ? roundForUnit(cToTemperatureUnit(limits.minTempC, unit), unit)
          : undefined,
      max:
        typeof limits.maxTempC === "number"
          ? roundForUnit(cToTemperatureUnit(limits.maxTempC, unit), unit)
          : undefined,
    };
  }, [tank, limits, metric]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!open || !tank) return;

      const channel = metric === "volume" ? tank.volumeChannel : tank.temperatureChannel;
      if (!channel) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(`No ${metric} channel configured.`);
          setHistoryLoading(false);
        }
        return;
      }

      const start = parseDateInput(startStr);
      const end = parseDateInput(endStr);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError("");
          setHistoryLoading(false);
        }
        return;
      }

      const stop = new Date(end);
      stop.setDate(stop.getDate() + 1);

      if (!cancelled) {
        setHistoryLoading(true);
        setHistoryError("");
      }

      try {
        const res = await fetch(
          `/api/influx/history/${encodeURIComponent(channel)}?start=${encodeURIComponent(
            start.toISOString()
          )}&end=${encodeURIComponent(stop.toISOString())}`,
          { cache: "no-store" }
        );

        const j = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!cancelled) {
            setHistory([]);
            setHistoryError(j?.error || "Failed to load history");
            setHistoryLoading(false);
          }
          return;
        }

        const rows = Array.isArray(j?.rows) ? j.rows : [];
        const capacity = tank.capacityLiters ?? 1000;

        const mapped: ChartPoint[] = rows.map((r: any) => {
          const date = String(r?._time ?? "").slice(0, 10);
          const raw = Number(r?._value);

          if (!Number.isFinite(raw)) {
            return { date, value: 0, alarm: false };
          }

          if (metric === "volume") {
            const unit = tank.volumeUnit ?? "L";
            const liters = convertVolumeRawToLiters(raw, unit, capacity);
            const displayValue =
              unit === "%"
                ? roundForUnit(raw, unit)
                : roundForUnit(
                    litersToVolumeUnit(liters, { capacityLiters: capacity }, unit),
                    unit
                  );

            return {
              date,
              value: displayValue,
              alarm:
                !!limits &&
                ((typeof limits.minVolumeL === "number" && liters < limits.minVolumeL) ||
                  (typeof limits.maxVolumeL === "number" && liters > limits.maxVolumeL)),
            };
          }

          const unit = tank.temperatureUnit ?? "°C";
          const tempC = convertTemperatureRawToC(raw, unit);
          const displayValue =
            unit === "°F"
              ? roundForUnit(cToTemperatureUnit(tempC, unit), unit)
              : roundForUnit(tempC, unit);

          return {
            date,
            value: displayValue,
            alarm:
              !!limits &&
              ((typeof limits.minTempC === "number" && tempC < limits.minTempC) ||
                (typeof limits.maxTempC === "number" && tempC > limits.maxTempC)),
          };
        });

        if (!cancelled) {
          setHistory(mapped);
          setHistoryLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHistory([]);
          setHistoryError("Failed to load history");
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    tank?.id,
    tank?.volumeChannel,
    tank?.temperatureChannel,
    tank?.volumeUnit,
    tank?.temperatureUnit,
    tank?.capacityLiters,
    metric,
    startStr,
    endStr,
    limits?.minVolumeL,
    limits?.maxVolumeL,
    limits?.minTempC,
    limits?.maxTempC,
  ]);

  const alarmEvents = React.useMemo(() => {
    return history.filter((p) => p.alarm);
  }, [history]);

  if (!open || !tank) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="absolute inset-0 md:left-1/2 md:top-1/2 md:inset-auto md:w-[95vw] md:max-w-5xl md:-translate-x-1/2 md:-translate-y-1/2">
        <div
          className="h-full overflow-y-auto rounded-none border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:max-h-[85vh] md:rounded-2xl md:p-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold text-white md:text-xl">
                <span className="truncate">{tankName}</span>
                {alarmNow ? (
                  <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-200">
                    ALARM
                  </span>
                ) : null}
              </div>

              <div className="text-sm text-white/60">
                Temp:{" "}
                {typeof tank.temperatureValue === "number"
                  ? `${tank.temperatureValue}${tank.temperatureUnit ?? "°C"}`
                  : typeof tank.temperatureC === "number"
                  ? `${tank.temperatureC.toFixed(1)}°C`
                  : "--"}
                <span className="mx-2 text-white/25">•</span>
                Vol:{" "}
                {typeof tank.volumeValue === "number"
                  ? `${tank.volumeValue}${tank.volumeUnit ?? "L"}`
                  : `${Math.round(currentVolumeLiters)}L`}
              </div>

              {limits ? (
                <div className="mt-1 text-xs text-white/45">
                  Limits:{" "}
                  {typeof limits.minVolumeL === "number" ? `Vol ≥ ${limits.minVolumeL}L` : "—"}
                  {typeof limits.maxVolumeL === "number" ? `, Vol ≤ ${limits.maxVolumeL}L` : ""}
                  {" · "}
                  {typeof limits.minTempC === "number" ? `Temp ≥ ${limits.minTempC}°C` : "—"}
                  {typeof limits.maxTempC === "number" ? `, Temp ≤ ${limits.maxTempC}°C` : ""}
                </div>
              ) : (
                <div className="mt-1 text-xs text-white/45">No alarm limits set.</div>
              )}

              <div className={alarmNow ? "mt-2 text-xs text-red-200" : "mt-2 text-xs text-emerald-200/85"}>
                {alarmNow
                  ? `Alarm active${alarmReasons.length ? ` • ${alarmReasons.join(", ")}` : ""}`
                  : "Within limits"}
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
              <FluidTank
                level={selectedDisplay.visualLevel}
                capacityLiters={tank.capacityLiters ?? 1000}
                variant="rect"
                width={220}
                height={280}
                alarm={alarmNow}
                surface="flat"
                displayValue={selectedDisplay.value}
                displayUnit={selectedDisplay.label}
                accent={selectedDisplay.accent}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setMetric("volume")}
                    className={[
                      "rounded-full border px-4 py-2 text-xs transition",
                      volumeAlarmNow
                        ? metric === "volume"
                          ? "border-red-400/60 bg-red-500/20 text-red-100"
                          : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                        : metric === "volume"
                        ? "border-white/20 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                    ].join(" ")}
                  >
                    Volume
                  </button>

                  <button
                    onClick={() => setMetric("temperature")}
                    className={[
                      "rounded-full border px-4 py-2 text-xs transition",
                      temperatureAlarmNow
                        ? metric === "temperature"
                          ? "border-red-400/60 bg-red-500/20 text-red-100"
                          : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                        : metric === "temperature"
                        ? "border-white/20 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                    ].join(" ")}
                  >
                    Temperature
                  </button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-[11px] text-white/50">From</span>
                    <input
                      type="date"
                      value={startStr}
                      onChange={(e) => setStartStr(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/85 outline-none sm:w-[155px]"
                    />
                  </div>

                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-[11px] text-white/50">To</span>
                    <input
                      type="date"
                      value={endStr}
                      onChange={(e) => setEndStr(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/85 outline-none sm:w-[155px]"
                    />
                  </div>
                </div>
              </div>

              {startStr > endStr ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  Start date must be before end date.
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {historyError}
                </div>
              ) : historyLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                  Loading history...
                </div>
              ) : (
                <TankHistoryChart
                  data={history}
                  metric={metric}
                  unitLabel={selectedDisplay.label}
                  minLine={thresholdLines.min}
                  maxLine={thresholdLines.max}
                />
              )}

              <div className="text-xs text-white/45">
                Showing {history.length} day(s).
                {limits ? (
                  <>
                    <span className="mx-1 text-white/25">•</span>
                    Alarm points: {alarmEvents.length}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="h-6 md:hidden" />
        </div>
      </div>
    </div>
  );
}
