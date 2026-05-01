"use client";

import React from "react";
import FluidTank from "./FluidTankClient";
import TankHistoryChart from "./TankHistoryChart";
import type { Tank } from "./TankGrid";
import type { TankAlarmLimits } from "@/types/alarm";
import { 
  type VolumeUnit, 
  type TemperatureUnit,
  convertFromLiters,
  convertTemperature,
  convertMaToLiters,
  convertToLiters
} from "@/lib/conversions";
import { 
  normalizeLevelPercent, 
  currentVolumeL, 
  getTankAlarmReasons,
  pickAlarmLimits as pickLimits
} from "@/lib/alarm";

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
  hourlyRefreshInterval?: number;
}) {
  const tankId = tank?.id ?? "";
  const tankName = tank?.name ?? "";

  const [metric, setMetric] = React.useState<TankMetric>("volume");
  const [history, setHistory] = React.useState<ChartPoint[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState("");

  const [resolution, setResolution] = React.useState<"daily" | "time">("daily");
  const [startTimeStr, setStartTimeStr] = React.useState("00:00");
  const [endTimeStr, setEndTimeStr] = React.useState("23:59");

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
    setMetric(tank?.disableVolume && !tank?.disableTemperature ? "temperature" : "volume");
    setStartStr(toDateInputValue(defaultStart));
    setEndStr(toDateInputValue(today));
  }, [open, tankId, defaultStart, today]);

  const limits = React.useMemo(() => {
    if (!tank) return undefined;
    return pickLimits(alarmMap, tank);
  }, [tank, alarmMap]);

  const currentVolumeLiters = React.useMemo(() => currentVolumeL(tank), [tank]);

  const alarmReasons = React.useMemo(() => {
    if (!tank || !limits) return [];
    return getTankAlarmReasons(tank, limits);
  }, [tank, limits]);

  const alarmNow = alarmReasons.length > 0;
  const volumeAlarmNow = alarmReasons.some(r => r.includes("Volume"));
  const temperatureAlarmNow = alarmReasons.some(r => r.includes("Temp"));

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
              convertFromLiters(
                currentVolumeLiters,
                label,
                tank.capacityLiters ?? 1000
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
        : roundForUnit(convertTemperature(tank.temperatureC ?? 0, "°C", label), label);

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
                convertFromLiters(
                  limits.minVolumeL,
                  unit,
                  tank.capacityLiters ?? 1000
                ),
                unit
              )
            : undefined,
        max:
          typeof limits.maxVolumeL === "number"
            ? roundForUnit(
                convertFromLiters(
                  limits.maxVolumeL,
                  unit,
                  tank.capacityLiters ?? 1000
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
          ? roundForUnit(convertTemperature(limits.minTempC, "°C", unit), unit)
          : undefined,
      max:
        typeof limits.maxTempC === "number"
          ? roundForUnit(convertTemperature(limits.maxTempC, "°C", unit), unit)
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
      const stop = parseDateInput(endStr);

      if (resolution === "time") {
        const [sh, sm] = startTimeStr.split(':').map(Number);
        start.setHours(sh || 0, sm || 0, 0, 0);
        const [eh, em] = endTimeStr.split(':').map(Number);
        stop.setHours(eh || 23, em || 59, 59, 999);
      } else {
        stop.setDate(stop.getDate() + 1);
      }

      if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime()) || start > stop) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError("");
          setHistoryLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setHistoryLoading(true);
        setHistoryError("");
      }

      try {
        const res = await fetch(
          `/api/influx/history/${encodeURIComponent(channel)}?start=${encodeURIComponent(
            start.toISOString()
          )}&end=${encodeURIComponent(stop.toISOString())}&res=${resolution}`,
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
          const date = resolution === "time"
            ? new Date(r._time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : String(r?._time ?? "").slice(0, 10);
          
          const raw = r?._value !== null ? Number(r._value) : null;

          if (raw === null || !Number.isFinite(raw)) {
            return { date, value: null, alarm: false };
          }

          if (metric === "volume") {
            const unit = tank.volumeUnit ?? "L";
            const liters = convertMaToLiters(raw, capacity, tank.volumeMode);
            const displayValue = roundForUnit(
              convertFromLiters(liters, unit, capacity),
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
          let tempC = 0;
          if (tank.temperatureMode === "percent") {
            tempC = raw;
          } else if (tank.temperatureMode === "inverted") {
            tempC = 100 - raw;
          } else {
            tempC = convertTemperature(raw, unit, "°C");
          }

          const displayValue =
            unit === "°F"
              ? roundForUnit(convertTemperature(tempC, "°C", unit), unit)
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
    startTimeStr,
    endTimeStr,
    resolution,
    limits?.minVolumeL,
    limits?.maxVolumeL,
    limits?.minTempC,
    limits?.maxTempC,
  ]);

  /**
   * Inject the live tank value into the chart dataset.
   * Replaces the last data point's value with the current live reading,
   * or appends a single point if history is empty.
   * This ensures the plotted line ends at the real system state.
   */
  const chartDataWithLive = React.useMemo(() => {
    if (!tank) return history;

    // Compute the live display value for the current metric
    let liveDisplayValue: number;
    let isLiveAlarm = false;

    if (metric === "volume") {
      const unit = tank.volumeUnit ?? "L";
      const cap = tank.capacityLiters ?? 1000;
      liveDisplayValue =
        typeof tank.volumeValue === "number"
          ? tank.volumeValue
          : roundForUnit(convertFromLiters(currentVolumeLiters, unit, cap), unit);

      // Recalculate alarm status for this live point
      isLiveAlarm =
        !!limits &&
        ((typeof limits.minVolumeL === "number" && currentVolumeLiters < limits.minVolumeL) ||
          (typeof limits.maxVolumeL === "number" && currentVolumeLiters > limits.maxVolumeL));
    } else {
      const unit = tank.temperatureUnit ?? "°C";
      const tempC = tank.temperatureC ?? 0;
      liveDisplayValue =
        typeof tank.temperatureValue === "number"
          ? tank.temperatureValue
          : roundForUnit(convertTemperature(tempC, "°C", unit), unit);

      isLiveAlarm =
        !!limits &&
        ((typeof limits.minTempC === "number" && tempC < limits.minTempC) ||
          (typeof limits.maxTempC === "number" && tempC > limits.maxTempC));
    }

    // Format today as YYYY-MM-DD (local time) to match historical data format
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // If no history data, create a single point with today's date
    if (history.length === 0) {
      return [{ date: todayStr, value: liveDisplayValue, alarm: isLiveAlarm }];
    }

    const updated = [...history];
    const lastPoint = updated[updated.length - 1];

    if (lastPoint.date === todayStr) {
      // If the last point is already today, replace its value with live data
      updated[updated.length - 1] = {
        ...lastPoint,
        value: liveDisplayValue,
        alarm: isLiveAlarm,
      };
    } else {
      // Otherwise, append a new point for today
      updated.push({
        date: todayStr,
        value: liveDisplayValue,
        alarm: isLiveAlarm,
      });
    }

    return updated;
  }, [history, tank, metric, currentVolumeLiters, limits]);

  const alarmEvents = React.useMemo(() => {
    return chartDataWithLive.filter((p) => p.alarm);
  }, [chartDataWithLive]);

  if (!open || !tank) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="absolute inset-0 md:left-1/2 md:top-1/2 md:inset-auto md:w-[95vw] md:max-w-5xl md:-translate-x-1/2 md:-translate-y-1/2">
        <div
          className="h-full overflow-y-auto rounded-none border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:max-h-[85vh] md:rounded-2xl md:p-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white md:text-xl">
                <span className="truncate">{tankName}</span>
                {alarmNow ? (
                  <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-200">
                    ALARM
                  </span>
                ) : null}
              </div>

              <div className="text-sm text-black/60 dark:text-white/60">
                {!tank.disableTemperature && (
                  <>
                    Temp:{" "}
                    {typeof tank.temperatureValue === "number"
                      ? `${tank.temperatureValue}${tank.temperatureUnit ?? "°C"}`
                      : typeof tank.temperatureC === "number"
                      ? `${tank.temperatureC.toFixed(1)}°C`
                      : "--"}
                  </>
                )}
                {!tank.disableTemperature && !tank.disableVolume && (
                  <span className="mx-2 text-black/25 dark:text-white/25">•</span>
                )}
                {!tank.disableVolume && (
                  <>
                    Vol:{" "}
                    {typeof tank.volumeValue === "number"
                      ? `${tank.volumeValue}${tank.volumeUnit ?? "L"}`
                      : `${Math.round(currentVolumeLiters)}L`}
                  </>
                )}
              </div>

              {limits ? (
                <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                  Limits:{" "}
                  {typeof limits.minVolumeL === "number" ? `Vol ≥ ${limits.minVolumeL}L` : "—"}
                  {typeof limits.maxVolumeL === "number" ? `, Vol ≤ ${limits.maxVolumeL}L` : ""}
                  {" · "}
                  {typeof limits.minTempC === "number" ? `Temp ≥ ${limits.minTempC}°C` : "—"}
                  {typeof limits.maxTempC === "number" ? `, Temp ≤ ${limits.maxTempC}°C` : ""}
                </div>
              ) : (
                <div className="mt-1 text-xs text-black/45 dark:text-white/45">No alarm limits set.</div>
              )}

              <div className={alarmNow ? "mt-2 text-xs text-red-600 dark:text-red-200" : "mt-2 text-xs text-emerald-600 dark:text-emerald-200/85"}>
                {alarmNow
                  ? `Alarm active${alarmReasons.length ? ` • ${alarmReasons.join(", ")}` : ""}`
                  : "Within limits"}
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs text-black/80 dark:text-white/80 transition hover:bg-black/10 dark:hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3 sm:p-4">
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
                fluidColor={selectedDisplay.accent === "volume" ? tank.fluidColor : tank.tempColor}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {!tank?.disableVolume && (
                    <button
                      onClick={() => setMetric("volume")}
                      className={[
                        "rounded-full border px-4 py-2 text-xs transition",
                        volumeAlarmNow
                          ? metric === "volume"
                            ? "border-red-400/60 bg-red-500/20 text-red-900 dark:text-red-100"
                            : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200 hover:bg-red-500/15"
                          : metric === "volume"
                          ? "border-black/20 dark:border-white/20 bg-black/15 dark:bg-white/15 text-black dark:text-white"
                          : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      Volume
                    </button>
                  )}

                  {!tank?.disableTemperature && (
                    <button
                      onClick={() => setMetric("temperature")}
                      className={[
                        "rounded-full border px-4 py-2 text-xs transition",
                        temperatureAlarmNow
                          ? metric === "temperature"
                            ? "border-red-400/60 bg-red-500/20 text-red-900 dark:text-red-100"
                            : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200 hover:bg-red-500/15"
                          : metric === "temperature"
                          ? "border-black/20 dark:border-white/20 bg-black/15 dark:bg-white/15 text-black dark:text-white"
                          : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      Temperature
                    </button>
                  )}
                  <div className="w-px bg-black/10 dark:bg-white/10 mx-1" />
                  <button
                    onClick={() => setResolution("daily")}
                    className={[
                      "rounded-full border px-4 py-2 text-xs transition",
                      resolution === "daily"
                        ? "border-black/20 dark:border-white/20 bg-black/15 dark:bg-white/15 text-black dark:text-white"
                        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setResolution("time")}
                    className={[
                      "rounded-full border px-4 py-2 text-xs transition",
                      resolution === "time"
                        ? "border-black/20 dark:border-white/20 bg-black/15 dark:bg-white/15 text-black dark:text-white"
                        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    Time-based
                  </button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-[11px] text-black/50 dark:text-white/50">From</span>
                    <input
                      type="date"
                      value={startStr}
                      onChange={(e) => setStartStr(e.target.value)}
                      className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-xs text-black/85 dark:text-white/85 outline-none sm:w-[130px]"
                    />
                    {resolution === "time" && (
                      <input
                        type="time"
                        value={startTimeStr}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-xs text-black/85 dark:text-white/85 outline-none sm:w-[100px]"
                      />
                    )}
                  </div>

                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-[11px] text-black/50 dark:text-white/50">To</span>
                    <input
                      type="date"
                      value={endStr}
                      onChange={(e) => setEndStr(e.target.value)}
                      className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-xs text-black/85 dark:text-white/85 outline-none sm:w-[130px]"
                    />
                    {resolution === "time" && (
                      <input
                        type="time"
                        value={endTimeStr}
                        onChange={(e) => setEndTimeStr(e.target.value)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-xs text-black/85 dark:text-white/85 outline-none sm:w-[100px]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {startStr > endStr ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-200">
                  Start date must be before end date.
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-200">
                  {historyError}
                </div>
              ) : historyLoading ? (
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-6 text-sm text-black/60 dark:text-white/60">
                  Loading history...
                </div>
              ) : (
                <TankHistoryChart
                  data={chartDataWithLive}
                  metric={metric}
                  unitLabel={selectedDisplay.label}
                  minLine={thresholdLines.min}
                  maxLine={thresholdLines.max}
                  liveValue={selectedDisplay.value}
                  liveLabel={selectedDisplay.label}
                  color={selectedDisplay.accent === "volume" ? tank.fluidColor : tank.tempColor}
                />
              )}

              <div className="text-xs text-black/45 dark:text-white/45">
                Showing {chartDataWithLive.length} day(s).
                {limits ? (
                  <>
                    <span className="mx-1 text-black/25 dark:text-white/25">•</span>
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
