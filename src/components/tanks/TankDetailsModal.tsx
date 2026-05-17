"use client";

import React from "react";
import FluidTank from "./FluidTankClient";
import TankHistoryChart from "./TankHistoryChart";
import type { Tank } from "./TankGrid";
import type { TankAlarmLimits } from "@/types/alarm";
import {
  convertFromLiters,
  convertTemperature,
  convertMaToLiters,
} from "@/lib/conversions";
import {
  normalizeLevelPercent,
  currentVolumeL,
  getTankAlarmReasons,
  pickAlarmLimits as pickLimits,
} from "@/lib/alarm";
import { Download, FileText, X } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type TankMetric = "volume" | "temperature";

type ChartPoint = {
  date: string;
  value: number | null;
  alarm: boolean;
  timestamp: number;

  // Original sensor timestamp. Used by tooltip.
  actualTimestamp?: number;

  // True when previous value is carried into selected range start.
  carriedForward?: boolean;
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

function formatPointLabel(timestamp: number, resolution: "daily" | "time") {
  const d = new Date(timestamp);

  if (resolution === "time") {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function insertNullGaps(
  points: ChartPoint[],
  resolution: "daily" | "time"
): ChartPoint[] {
  return [...points].sort((a, b) => a.timestamp - b.timestamp);
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
}): React.ReactNode {
  const tankId = tank?.id ?? "";
  const tankName = tank?.name ?? "";

  const [metric, setMetric] = React.useState<TankMetric>("volume");
  const [history, setHistory] = React.useState<ChartPoint[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [historyError, setHistoryError] = React.useState("");

  const [resolution, setResolution] = React.useState<"daily" | "time">("daily");
  const [startTimeStr, setStartTimeStr] = React.useState("00:00");
  const [endTimeStr, setEndTimeStr] = React.useState("23:59");
  const [alarmHistory, setAlarmHistory] = React.useState<any[]>([]);

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
    setResolution("daily");
    setStartTimeStr("00:00");
    setEndTimeStr("23:59");
    setStartStr(toDateInputValue(defaultStart));
    setEndStr(toDateInputValue(today));
  }, [open, tankId, defaultStart, today, tank?.disableVolume, tank?.disableTemperature]);

  React.useEffect(() => {
    if (!open) return;

    const id = window.setInterval(() => {
      setRefreshKey((v) => v + 1);
    }, 60000);

    return () => window.clearInterval(id);
  }, [open]);

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
  const volumeAlarmNow = alarmReasons.some((r) => r.includes("Volume"));
  const temperatureAlarmNow = alarmReasons.some((r) => r.includes("Temp"));

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

  const chartXDomain = React.useMemo(() => {
    const start = parseDateInput(startStr);

    if (resolution === "time") {
      const end = parseDateInput(startStr);

      const [sh, sm] = startTimeStr.split(":").map(Number);
      const [eh, em] = endTimeStr.split(":").map(Number);

      start.setHours(sh || 0, sm || 0, 0, 0);
      end.setHours(eh || 23, em || 59, 59, 999);

      return [start.getTime(), end.getTime()] as [number, number];
    }

    const end = parseDateInput(endStr);
    end.setDate(end.getDate() + 1);

    return [start.getTime(), end.getTime()] as [number, number];
  }, [startStr, endStr, startTimeStr, endTimeStr, resolution]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const tnk = tank;
      if (!open || !tnk) return;

      const channel = metric === "volume" ? tnk.volumeChannel : tnk.temperatureChannel;

      if (!channel) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(`No ${metric} channel configured.`);
          setHistoryLoading(false);
        }
        return;
      }

      const start = parseDateInput(startStr);
      const stop = resolution === "time" ? parseDateInput(startStr) : parseDateInput(endStr);

      if (resolution === "time") {
        const [sh, sm] = startTimeStr.split(":").map(Number);
        const [eh, em] = endTimeStr.split(":").map(Number);

        start.setHours(sh || 0, sm || 0, 0, 0);
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
        if (history.length === 0) {
          setHistoryLoading(true);
        }
        setHistoryError("");
      }

      try {
        const [res, alarmRes] = await Promise.all([
          fetch(
            `/api/influx/history/${encodeURIComponent(channel)}?start=${encodeURIComponent(
              start.toISOString()
            )}&end=${encodeURIComponent(stop.toISOString())}&res=${resolution}`,
            { cache: "no-store" }
          ),
          fetch(
            `/api/alarms/history?slug=${tnk.companySlug || ""}&tankKey=${encodeURIComponent(
              tnk.tankKey || ""
            )}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(
              stop.toISOString()
            )}`,
            { cache: "no-store" }
          ),
        ]);

        const j = await res.json().catch(() => ({}));
        const aj = await alarmRes.json().catch(() => ({ rows: [] }));

        if (!res.ok) {
          if (!cancelled) {
            setHistory([]);
            setHistoryError(j?.error || "Failed to load history");
            setHistoryLoading(false);
          }
          return;
        }

        const rows = Array.isArray(j?.rows) ? j.rows : [];
        const alarmsHistoryRows = Array.isArray(aj?.rows) ? aj.rows : [];
        const capacity = tnk.capacityLiters ?? 1000;

        const mapInfluxRowToPoint = (r: any): ChartPoint => {
          const t = new Date(r._time).getTime();
          const date = formatPointLabel(t, resolution);

          const raw =
            r?._value !== null && r?._value !== undefined
              ? Number(r._value)
              : null;

          if (raw === null || !Number.isFinite(raw)) {
            return {
              date,
              value: null,
              alarm: false,
              timestamp: t,
              actualTimestamp: t,
            };
          }

          const hasHistoricalAlarm = alarmsHistoryRows.some((ar: any) => {
            const art = new Date(ar.created_at).getTime();
            const metricMatch = ar.metric === metric;

            return (
              metricMatch &&
              Math.abs(art - t) < (resolution === "time" ? 1800000 : 43200000)
            );
          });

          if (metric === "volume") {
            const unit = tnk.volumeUnit ?? "L";
            const configuredMode = tnk.volumeMode ?? "default";

            let effectiveMode = configuredMode;

            // If setup says default/mA but raw value looks like percent,
            // prevent treating 50–100 as 50mA–100mA.


            if (
              (effectiveMode === "percent" || effectiveMode === "inverted") &&
              (!Number.isFinite(raw) || raw < 0 || raw > 100)
            ) {
              return {
                date,
                value: null,
                alarm: false,
                timestamp: t,
                actualTimestamp: t,
              };
            }

            let liters = convertMaToLiters(raw, capacity, effectiveMode);

            // Apply calibration only for actual mA/default mode.
            liters = liters * (tnk.volumeM ?? 1.0) + (tnk.volumeC ?? 0.0);

            const displayValue = roundForUnit(
              convertFromLiters(liters, unit, capacity),
              unit
            );

            console.log("HISTORY VALUE CHECK", {
              raw,
              configuredMode,
              effectiveMode,
              capacity,
              volumeM: tnk.volumeM,
              volumeC: tnk.volumeC,
              liters,
              displayValue,
            });


            return {
              date,
              value: displayValue,
              timestamp: t,
              actualTimestamp: t,
              alarm:
                hasHistoricalAlarm ||
                (!!limits &&
                  ((typeof limits.minVolumeL === "number" && liters < limits.minVolumeL) ||
                    (typeof limits.maxVolumeL === "number" && liters > limits.maxVolumeL))),
            };
          }

          const unit = tnk.temperatureUnit ?? "°C";
          let tempC = 0;

          if (tnk.temperatureMode === "percent") {
            tempC = raw;
          } else if (tnk.temperatureMode === "inverted") {
            tempC = 100 - raw;
          } else {
            tempC = convertTemperature(raw, unit, "°C");
          }

          tempC = tempC * (tnk.temperatureM ?? 1.0) + (tnk.temperatureC_factor ?? 0.0);

          const displayValue =
            unit === "°F"
              ? roundForUnit(convertTemperature(tempC, "°C", unit), unit)
              : roundForUnit(tempC, unit);

          return {
            date,
            value: displayValue,
            timestamp: t,
            actualTimestamp: t,
            alarm:
              hasHistoricalAlarm ||
              (!!limits &&
                ((typeof limits.minTempC === "number" && tempC < limits.minTempC) ||
                  (typeof limits.maxTempC === "number" && tempC > limits.maxTempC))),
          };
        };

        let mapped: ChartPoint[] = rows.map(mapInfluxRowToPoint);
 
        const rangeStart = start.getTime();
        const rangeEnd = stop.getTime();
 
        const prePoint = [...mapped]
          .filter((p) => p.timestamp < rangeStart && typeof p.value === "number")
          .sort((a, b) => b.timestamp - a.timestamp)[0];
 
        const postPoint = [...mapped]
          .filter((p) => p.timestamp > rangeEnd && typeof p.value === "number")
          .sort((a, b) => a.timestamp - b.timestamp)[0];
 
        const inRangePoints = mapped.filter(
          (p) => p.timestamp >= rangeStart && p.timestamp <= rangeEnd
        );
 
        let finalPoints = [...inRangePoints];
        if (prePoint) {
          finalPoints.unshift(prePoint);
        }
        if (postPoint) {
          finalPoints.push(postPoint);
        }
 
        mapped = finalPoints;

        mapped = insertNullGaps(mapped, resolution);
        const nowMs = Date.now();

        mapped = mapped.filter((p) => p.timestamp <= nowMs);

        console.log({
          metric,
          resolution,
          channel,
          start: start.toISOString(),
          stop: stop.toISOString(),
          rawRows: rows.length,
          mappedRows: mapped.length,
          prePoint: prePoint ?? null,
          postPoint: postPoint ?? null,
        });
        console.table(
          mapped.map((p) => ({
            date: p.date,
            value: p.value,
            chartTime: new Date(p.timestamp).toLocaleString(),
            actualTime: p.actualTimestamp
              ? new Date(p.actualTimestamp).toLocaleString()
              : "",
            carriedForward: p.carriedForward,
          }))
        );
        console.log("=========================================");

        if (!cancelled) {
          setHistory(mapped);
          setAlarmHistory(alarmsHistoryRows);
          setHistoryLoading(false);
        }
      } catch (err) {
        console.error("Failed to load history:", err);

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
    tank?.volumeMode,
    tank?.temperatureMode,
    tank?.volumeM,
    tank?.volumeC,
    tank?.temperatureM,
    tank?.temperatureC_factor,
    tank?.companySlug,
    tank?.tankKey,
    metric,
    startStr,
    endStr,
    startTimeStr,
    endTimeStr,
    resolution,
    refreshKey,
    history.length,
    limits?.minVolumeL,
    limits?.maxVolumeL,
    limits?.minTempC,
    limits?.maxTempC,
  ]);

  const chartDataWithLive = React.useMemo(() => {
    if (!tank) return history;

    let liveDisplayValue: number;
    let isLiveAlarm = false;

    if (metric === "volume") {
      const unit = tank.volumeUnit ?? "L";
      const cap = tank.capacityLiters ?? 1000;

      liveDisplayValue = selectedDisplay.value;

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

    const now = new Date();
    const nowT = now.getTime();
    const [dMin, dMax] = chartXDomain;

    const isNowInRange = nowT >= dMin && nowT <= dMax + 10 * 60 * 1000;
    if (!isNowInRange) return history;

    const displayLabel =
      resolution === "time"
        ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : now.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

    const livePoint: ChartPoint = {
      date: displayLabel,
      value: liveDisplayValue,
      alarm: isLiveAlarm,
      timestamp: nowT,
      actualTimestamp: nowT,
    };

    if (history.length === 0) {
      return [livePoint];
    }

    const updated = [...history];
    const lastPoint = updated[updated.length - 1];

    if (lastPoint.date === displayLabel) {
      updated[updated.length - 1] = {
        ...lastPoint,
        value: liveDisplayValue,
        alarm: isLiveAlarm,
        timestamp: nowT,
        actualTimestamp: nowT,
      };
    } else {
      updated.push(livePoint);
    }

    return insertNullGaps(updated, resolution);
  }, [
    history,
    tank,
    metric,
    currentVolumeLiters,
    limits,
    resolution,
    chartXDomain,
    selectedDisplay.value,
  ]);

  const handleExportCSV = async (type: "history" | "alarms") => {
    if (!tank) return;

    const startDate = new Date(chartXDomain[0]).toISOString();
    const endDate = new Date(chartXDomain[1]).toISOString();

    if (type === "history") {
      const channel = metric === "volume" ? tank.volumeChannel : tank.temperatureChannel;
      const url = `/api/influx/history/export?channel=${channel}&slug=${tank.companySlug}&tankKey=${tank.tankKey}&start=${startDate}&end=${endDate}&res=${resolution}&tankName=${encodeURIComponent(tank.name)}`;
      window.open(url, "_blank");
    } else {
      const url = `/api/alarms/export?slug=${tank.companySlug}&tankKey=${tank.tankKey}&start=${startDate}&end=${endDate}`;
      window.open(url, "_blank");
    }
  };

  const handleExportPDF = (type: "history" | "alarms") => {
    if (!tank) return;
    const doc = new jsPDF();
    const title = type === "history" ? `${tank.name} - History Report` : `${tank.name} - Alarm History Report`;
    const unit = metric === "volume" ? tank.volumeUnit : tank.temperatureUnit;

    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Period: ${new Date(chartXDomain[0]).toLocaleDateString()} to ${new Date(chartXDomain[1]).toLocaleDateString()}`, 14, 37);
    doc.text(`Metric: ${metric === 'volume' ? 'Volume' : 'Temperature'}`, 14, 44);

    if (type === "history") {
      const tableData = history.map(h => [
        h.date,
        h.value != null ? `${h.value.toFixed(2)} ${unit}` : "N/A"
      ]);
      autoTable(doc, {
        head: [['Timestamp', 'Value']],
        body: tableData,
        startY: 50,
      });
    } else {
      const tableData = alarmHistory.map(a => [
        new Date(a.created_at).toLocaleString(),
        `${a.value.toFixed(2)} ${unit}`,
        a.threshold_type === 'min' ? 'Low Alarm' : 'High Alarm',
        `${a.threshold.toFixed(2)} ${unit}`
      ]);
      autoTable(doc, {
        head: [['Timestamp', 'Value', 'Alarm Type', 'Threshold']],
        body: tableData,
        startY: 50,
      });
    }

    doc.save(`${tank.name}_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const alarmEvents = React.useMemo(() => {
    return chartDataWithLive.filter((p) => p.alarm);
  }, [chartDataWithLive]);

  if (!open || !tank) return null;

  const invalidRange = resolution !== "time" && startStr > endStr;

  console.log("MODAL CHART DOMAIN DEBUG", {
    resolution,
    startStr,
    endStr,
    startTimeStr,
    endTimeStr,
    chartXDomain,
    startLabel: new Date(chartXDomain[0]).toLocaleString(),
    endLabel: new Date(chartXDomain[1]).toLocaleString(),
  });

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="absolute inset-0 md:left-1/2 md:top-1/2 md:inset-auto md:w-[95vw] md:max-w-5xl md:-translate-x-1/2 md:-translate-y-1/2">
        <div
          className="h-full overflow-y-auto rounded-none border border-black/10 bg-white p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:max-h-[85vh] md:rounded-2xl md:p-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white md:text-xl">
                <span className="truncate">{tankName}</span>

                {tank.isDisabled ? (
                  <span className="shrink-0 rounded-full border border-black/20 bg-black/10 px-2 py-0.5 text-[10px] font-bold text-black/50 dark:border-white/20 dark:bg-white/10 dark:text-white/50">
                    DISABLED
                  </span>
                ) : alarmNow ? (
                  <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-200">
                    ALARM
                  </span>
                ) : null}
              </div>

              <div className="text-sm text-black/60 dark:text-white/60">
                {tank.isDisabled ? (
                  <span className="italic opacity-70">No live data fetching</span>
                ) : (
                  <>
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
                <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                  No alarm limits set.
                </div>
              )}

              <div
                className={
                  tank.isDisabled
                    ? "mt-2 text-xs text-black/40 dark:text-white/40"
                    : alarmNow
                      ? "mt-2 text-xs text-red-600 dark:text-red-200"
                      : "mt-2 text-xs text-emerald-600 dark:text-emerald-200/85"
                }
              >
                {tank.isDisabled
                  ? "Tank is currently inactive"
                  : alarmNow
                    ? `Alarm active${alarmReasons.length ? ` • ${alarmReasons.join(", ")}` : ""}`
                    : "Within limits"}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
                <button
                  onClick={() => handleExportCSV("history")}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-black/60 transition hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                  title="Export History CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  onClick={() => handleExportPDF("history")}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-black/60 transition hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                  title="Export History PDF"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                {alarmHistory.length > 0 && (
                  <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />
                )}
                {alarmHistory.length > 0 && (
                  <>
                    <button
                      onClick={() => handleExportCSV("alarms")}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-red-500/70 transition hover:bg-red-500/5 hover:text-red-500"
                      title="Export Alarms CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Alarms CSV</span>
                    </button>
                    <button
                      onClick={() => handleExportPDF("alarms")}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-red-500/70 transition hover:bg-red-500/5 hover:text-red-500"
                      title="Export Alarms PDF"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Alarms PDF</span>
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={onClose}
                className="shrink-0 rounded-full border border-black/15 bg-black/5 p-2 text-black/40 transition hover:bg-black/10 hover:text-black dark:border-white/15 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5 sm:p-4">
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
                  {!tank.disableVolume && (
                    <button
                      onClick={() => setMetric("volume")}
                      className={[
                        "rounded-full border px-4 py-2 text-xs transition",
                        volumeAlarmNow
                          ? metric === "volume"
                            ? "border-red-400/60 bg-red-500/20 text-red-900 dark:text-red-100"
                            : "border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-200"
                          : metric === "volume"
                            ? "border-black/20 bg-black/15 text-black dark:border-white/20 dark:bg-white/15 dark:text-white"
                            : "border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      Volume
                    </button>
                  )}

                  {!tank.disableTemperature && (
                    <button
                      onClick={() => setMetric("temperature")}
                      className={[
                        "rounded-full border px-4 py-2 text-xs transition",
                        temperatureAlarmNow
                          ? metric === "temperature"
                            ? "border-red-400/60 bg-red-500/20 text-red-900 dark:text-red-100"
                            : "border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-200"
                          : metric === "temperature"
                            ? "border-black/20 bg-black/15 text-black dark:border-white/20 dark:bg-white/15 dark:text-white"
                            : "border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      Temperature
                    </button>
                  )}

                  <div className="mx-1 w-px bg-black/10 dark:bg-white/10" />

                  <button
                    onClick={() => setResolution("daily")}
                    className={[
                      "rounded-full border px-4 py-2 text-xs transition",
                      resolution === "daily"
                        ? "border-black/20 bg-black/15 text-black dark:border-white/20 dark:bg-white/15 dark:text-white"
                        : "border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    Daily
                  </button>

                  <button
                    onClick={() => {
                      setResolution("time");
                      setEndStr(startStr);
                    }}
                    className={[
                      "rounded-full border px-4 py-2 text-xs transition",
                      resolution === "time"
                        ? "border-black/20 bg-black/15 text-black dark:border-white/20 dark:bg-white/15 dark:text-white"
                        : "border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    Time-based
                  </button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-[11px] text-black/50 dark:text-white/50">
                      {resolution === "time" ? "Date" : "From"}
                    </span>

                    <input
                      type="date"
                      value={startStr}
                      onChange={(e) => {
                        setStartStr(e.target.value);
                        if (resolution === "time") setEndStr(e.target.value);
                      }}
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/85 outline-none dark:border-white/10 dark:bg-black/20 dark:text-white/85 sm:w-[130px]"
                    />

                    {resolution === "time" && (
                      <input
                        type="time"
                        value={startTimeStr}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/85 outline-none dark:border-white/10 dark:bg-black/20 dark:text-white/85 sm:w-[100px]"
                      />
                    )}
                  </div>

                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-[11px] text-black/50 dark:text-white/50">
                      To
                    </span>

                    {resolution !== "time" && (
                      <input
                        type="date"
                        value={endStr}
                        onChange={(e) => setEndStr(e.target.value)}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/85 outline-none dark:border-white/10 dark:bg-black/20 dark:text-white/85 sm:w-[130px]"
                      />
                    )}

                    {resolution === "time" && (
                      <input
                        type="time"
                        value={endTimeStr}
                        onChange={(e) => setEndTimeStr(e.target.value)}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/85 outline-none dark:border-white/10 dark:bg-black/20 dark:text-white/85 sm:w-[100px]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {invalidRange ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-200">
                  Start date must be before end date.
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-200">
                  {historyError}
                </div>
              ) : historyLoading ? (
                <div className="rounded-2xl border border-black/10 bg-black/5 p-6 text-sm text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
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
                  capacity={tank.capacityLiters}
                  xDomain={chartXDomain}
                />
              )}

              <div className="flex items-center justify-between text-xs text-black/45 dark:text-white/45">
                <div>
                  {resolution === "time" ? (
                    <>Showing data for {startTimeStr} to {endTimeStr}</>
                  ) : (
                    <>Showing {chartDataWithLive.length} point(s).</>
                  )}

                </div>

              </div>
            </div>
          </div>

          <div className="h-6 md:hidden" />
        </div>
      </div>
    </div>
  );
}