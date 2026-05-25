"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Layers,
  Activity,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { Tank } from "./TankGrid";
import type { TankAlarmLimits } from "@/types/alarm";
import {
  convertFromLiters,
  convertTemperature,
  convertMaToLiters,
  type VolumeUnit,
  type TemperatureUnit,
} from "@/lib/conversions";
import {
  normalizeLevelPercent,
  currentVolumeL,
  getTankAlarmReasons,
  pickAlarmLimits as pickLimits,
} from "@/lib/alarm";

type TankMetric = "volume" | "temperature";

type ChartPoint = {
  date: string;
  value: number | null;
  alarm: boolean;
  timestamp: number;
  actualTimestamp?: number;
  carriedForward?: boolean;
};

function formatPointLabel(timestamp: number, resolution: string) {
  const d = new Date(timestamp);
  
  if (resolution === "1m" || resolution === "5m" || resolution === "15m" || resolution === "1h") {
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

function roundForUnit(value: number, unitLabel: string) {
  if (!Number.isFinite(value)) return 0;
  if (unitLabel === "m³") return Math.round(value * 100) / 100;
  if (unitLabel === "%" || unitLabel === "°C" || unitLabel === "°F") {
    return Math.round(value * 10) / 10;
  }
  return Math.round(value);
}

function toLocalYYYYMMDD(timestamp: number) {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Map dynamic timeline range in ms to Influx-safe resolution intervals
function computeAutoResolution(rangeMs: number): string {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  
  if (rangeMs >= 3 * 365 * ONE_DAY) {
    return "30d"; // Years -> Group by Month (30d)
  }
  if (rangeMs >= 6 * 30 * ONE_DAY) {
    return "7d";  // Months -> Group by Week (7d)
  }
  if (rangeMs >= 15 * ONE_DAY) {
    return "1d";  // Multi-week -> Group by Day
  }
  if (rangeMs >= 2 * ONE_DAY) {
    return "1h";  // Multi-day -> Group by Hour
  }
  if (rangeMs >= 6 * ONE_HOUR) {
    return "15m"; // Multi-hour -> Group by 15 mins
  }
  return "1m";    // Dynamic fine scale -> Group by Minute
}

interface CustomTooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: any[];
  metric: TankMetric;
  unitLabel: string;
}

function CustomTooltip({
  active,
  label,
  payload,
  metric,
  unitLabel,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const validPayload = payload.find(
    (p) => typeof p?.value === "number" && (p?.dataKey === "value" || p?.name === "value")
  );

  if (!validPayload) return null;

  const point = validPayload.payload as ChartPoint;
  const value = Number(validPayload.value);
  const displayTimestamp = point.actualTimestamp ?? Number(label);
  const date = new Date(displayTimestamp);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-2 text-[10px] text-white/50 tracking-wider">
        {date.toLocaleString([], {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}
      </div>
      <div className="flex items-center gap-2 font-bold text-sm">
        <span
          className={`h-2.5 w-2.5 rounded-full ${point.alarm ? "bg-red-500 animate-ping" : "bg-cyan-400"}`}
        />
        <span>
          {metric === "volume" ? "Volume" : "Temperature"}:{" "}
          {value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unitLabel}
        </span>
      </div>
      {point.alarm && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-red-400">
          <AlertTriangle className="h-3 w-3" />
          <span>Alarm Threshold Exceeded</span>
        </div>
      )}
    </div>
  );
}

export default function TankHistoryChartFullScreen({
  tank,
  metric,
  unitLabel,
  color,
  initialDomain,
  alarmMap,
  onClose,
}: {
  tank: Tank;
  metric: TankMetric;
  unitLabel: string;
  color?: string;
  initialDomain: [number, number];
  alarmMap: Record<string, TankAlarmLimits>;
  onClose: () => void;
}) {
  const [domain, setDomain] = React.useState<[number, number]>(initialDomain);
  const [history, setHistory] = React.useState<ChartPoint[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [resMode, setResMode] = React.useState<"auto" | "1m" | "5m" | "15m" | "1h" | "1d">("auto");
  const [isPanning, setIsPanning] = React.useState(false);

  const startPointerX = React.useRef<number | null>(null);
  const startPointerDomain = React.useRef<[number, number] | null>(null);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);

  // Pick limits
  const limits = React.useMemo(() => {
    return pickLimits(alarmMap, tank);
  }, [tank, alarmMap]);

  // Compute active resolution
  const activeResolution = React.useMemo(() => {
    if (resMode === "auto") {
      const diff = domain[1] - domain[0];
      return computeAutoResolution(diff);
    }
    return resMode;
  }, [domain, resMode]);

  // Calculate dynamic threshold lines (Y-axis references)
  const thresholdLines = React.useMemo(() => {
    if (!limits) return {};
    const cap = tank.capacityLiters ?? 1000;

    if (metric === "volume") {
      return {
        min: typeof limits.minVolumeL === "number"
          ? roundForUnit(convertFromLiters(limits.minVolumeL, unitLabel as VolumeUnit, cap), unitLabel)
          : undefined,
        max: typeof limits.maxVolumeL === "number"
          ? roundForUnit(convertFromLiters(limits.maxVolumeL, unitLabel as VolumeUnit, cap), unitLabel)
          : undefined,
      };
    }

    return {
      min: typeof limits.minTempC === "number"
        ? roundForUnit(convertTemperature(limits.minTempC, "°C", unitLabel as TemperatureUnit), unitLabel)
        : undefined,
      max: typeof limits.maxTempC === "number"
        ? roundForUnit(convertTemperature(limits.maxTempC, "°C", unitLabel as TemperatureUnit), unitLabel)
        : undefined,
    };
  }, [limits, metric, unitLabel, tank]);

  // Fetch history data for active range + resolution (debounced to avoid spamming server)
  React.useEffect(() => {
    let active = true;
    const channel = metric === "volume" ? tank.volumeChannel : tank.temperatureChannel;
    if (!channel) return;

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const startISO = new Date(domain[0]).toISOString();
        const endISO = new Date(domain[1]).toISOString();
        
        const response = await fetch(
          `/api/influx/history/${encodeURIComponent(channel)}?start=${encodeURIComponent(
            startISO
          )}&end=${encodeURIComponent(endISO)}&res=${activeResolution}`,
          { cache: "no-store" }
        );

        if (!response.ok) throw new Error("History fetch failed");

        const data = await response.json();
        if (!active) return;

        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const capacity = tank.capacityLiters ?? 1000;

        // Map database records into ChartPoints
        const mappedPoints: ChartPoint[] = rows.map((r: any) => {
          const t = new Date(r._time).getTime();
          const date = formatPointLabel(t, activeResolution);
          const raw = r?._value !== null && r?._value !== undefined ? Number(r._value) : null;

          if (raw === null || !Number.isFinite(raw)) {
            return { date, value: null, alarm: false, timestamp: t, actualTimestamp: t };
          }

          let val = 0;
          let isAlarm = false;

          if (metric === "volume") {
            const configuredMode = tank.volumeMode ?? "default";
            let liters = convertMaToLiters(raw, capacity, configuredMode);
            liters = liters * (tank.volumeM ?? 1.0) + (tank.volumeC ?? 0.0);
            val = roundForUnit(convertFromLiters(liters, unitLabel as VolumeUnit, capacity), unitLabel);
            
            isAlarm = !!limits && (
              (typeof limits.minVolumeL === "number" && liters < limits.minVolumeL) ||
              (typeof limits.maxVolumeL === "number" && liters > limits.maxVolumeL)
            );
          } else {
            let tempC = 0;
            if (tank.temperatureMode === "percent") {
              tempC = raw;
            } else if (tank.temperatureMode === "inverted") {
              tempC = 100 - raw;
            } else {
              tempC = convertTemperature(raw, unitLabel as TemperatureUnit, "°C");
            }
            tempC = tempC * (tank.temperatureM ?? 1.0) + (tank.temperatureC_factor ?? 0.0);
            val = unitLabel === "°F"
              ? roundForUnit(convertTemperature(tempC, "°C", unitLabel as TemperatureUnit), unitLabel)
              : roundForUnit(tempC, unitLabel);

            isAlarm = !!limits && (
              (typeof limits.minTempC === "number" && tempC < limits.minTempC) ||
              (typeof limits.maxTempC === "number" && tempC > limits.maxTempC)
            );
          }

          return {
            date,
            value: val,
            timestamp: t,
            actualTimestamp: t,
            alarm: isAlarm,
          };
        });

        setHistory(mappedPoints);
      } catch (err) {
        console.error("Fullscreen chart fetch error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [domain, activeResolution, metric, tank, unitLabel, limits]);

  // dynamic median-interval thresholds for segment builder
  const dottedThresholdMs = React.useMemo(() => {
    const sorted = [...history]
      .filter((p) => typeof p.timestamp === "number" && typeof p.value === "number")
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length < 2) {
      return 30 * 60 * 1000; // Fallback to 30 mins
    }

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (diff > 0) {
        intervals.push(diff);
      }
    }

    if (intervals.length === 0) {
      return 30 * 60 * 1000;
    }

    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    const baseInterval = Math.max(median, 10000);
    return baseInterval * 1.75;
  }, [history]);

  // Segment builder separating solid intervals and missing data gaps (red dotted lines)
  const { solidSegments, gapSegments } = React.useMemo(() => {
    const sorted = [...history]
      .filter((p) => typeof p.timestamp === "number")
      .sort((a, b) => a.timestamp - b.timestamp);

    const solidSegs: ChartPoint[][] = [];
    const gapSegs: ChartPoint[][] = [];

    let currentSolid: ChartPoint[] = [];
    let lastRealPoint: ChartPoint | null = null;

    for (const point of sorted) {
      const hasValue = typeof point.value === "number";

      if (!hasValue) {
        if (currentSolid.length > 0) {
          solidSegs.push(currentSolid);
          currentSolid = [];
        }
        continue;
      }

      if (lastRealPoint) {
        const gap = point.timestamp - lastRealPoint.timestamp;

        if (gap >= dottedThresholdMs) {
          if (currentSolid.length > 0) {
            solidSegs.push(currentSolid);
          }

          gapSegs.push([lastRealPoint, point]);

          currentSolid = [point];
          lastRealPoint = point;
          continue;
        }
      }

      currentSolid.push(point);
      lastRealPoint = point;
    }

    if (currentSolid.length > 0) {
      solidSegs.push(currentSolid);
    }

    return { solidSegments: solidSegs, gapSegments: gapSegs };
  }, [history, dottedThresholdMs]);

  // Pointer Down (Mouse Click / Finger Press) for Dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (chartContainerRef.current) {
      chartContainerRef.current.setPointerCapture(e.pointerId);
    }
    setIsPanning(true);
    startPointerX.current = e.clientX;
    startPointerDomain.current = [...domain];
  };

  // Pointer Move (Mouse Drag / Finger Swipe)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || startPointerX.current === null || startPointerDomain.current === null) return;
    const container = chartContainerRef.current;
    if (!container) return;

    const dx = startPointerX.current - e.clientX;
    const width = container.clientWidth;
    const startDomain = startPointerDomain.current;
    const domainWidth = startDomain[1] - startDomain[0];

    // Convert pixel offset to time offset
    const timeDelta = (dx / width) * domainWidth;
    
    // Slide range in real time
    setDomain([startDomain[0] + timeDelta, startDomain[1] + timeDelta]);
  };

  // Pointer Up (Mouse Release / Finger lift)
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (chartContainerRef.current) {
      chartContainerRef.current.releasePointerCapture(e.pointerId);
    }
    setIsPanning(false);
    startPointerX.current = null;
    startPointerDomain.current = null;
  };

  // Wheel Scroll for Zooming (Scaling)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = chartContainerRef.current;
    if (!container) return;

    // Scroll up (negative delta) zoom in; Scroll down (positive delta) zoom out
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    
    // Zoom centered on current horizontal cursor location
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, cursorX / rect.width));

    const currentRange = domain[1] - domain[0];
    const cursorTime = domain[0] + pct * currentRange;
    const newRange = currentRange * zoomFactor;

    // Clamp zoom window to reasonable bounds: 10 mins minimum, 5 years maximum
    if (newRange < 10 * 60 * 1000 || newRange > 5 * 365 * 24 * 60 * 60 * 1000) {
      return;
    }

    const nextStart = cursorTime - pct * newRange;
    const nextEnd = cursorTime + (1 - pct) * newRange;

    setDomain([nextStart, nextEnd]);
  };

  // Fast range buttons: 1D, 5D, 1M, 6M, 1Y, All
  const setQuickRange = (days: number) => {
    const end = Date.now();
    const start = end - days * 24 * 60 * 60 * 1000;
    setDomain([start, end]);
  };

  const handleResetZoom = () => {
    setDomain(initialDomain);
    setResMode("auto");
  };

  const handleStartDateChange = (valStr: string) => {
    if (!valStr) return;
    const newDate = new Date(valStr);
    newDate.setHours(0, 0, 0, 0);
    const newStart = newDate.getTime();
    if (newStart < domain[1]) {
      setDomain([newStart, domain[1]]);
    }
  };

  const handleEndDateChange = (valStr: string) => {
    if (!valStr) return;
    const newDate = new Date(valStr);
    newDate.setHours(23, 59, 59, 999);
    const newEnd = newDate.getTime();
    if (newEnd > domain[0]) {
      setDomain([domain[0], newEnd]);
    }
  };

  // Theme settings
  const themeColor = color || "#3b82f6";
  const hasData = history.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50/60 dark:bg-slate-950/60 p-4 md:p-8 backdrop-blur-2xl transition-all duration-300 font-sans text-slate-900 dark:text-white">
      
      {/* Dynamic Futuristic Glow Backdrops */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06)_0,transparent_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0,transparent_60%)] filter blur-3xl animate-pulse duration-5000" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.05)_0,transparent_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.1)_0,transparent_60%)] filter blur-3xl animate-pulse duration-[7000ms]" />
      </div>

      {/* Top Glassmorphic Header Panel */}
      <div className="relative z-10 flex flex-col gap-4 border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] p-4 md:px-6 rounded-2xl shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between transition-all duration-300">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2">
              <Activity className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl text-slate-900 dark:text-white drop-shadow-md">
                  {tank.name} Interactive Analytics
                </h1>
                <span
                  className={`h-2.5 w-2.5 rounded-full ring-4 ${
                    tank.hasData ? "bg-emerald-500 dark:bg-emerald-400 ring-emerald-400/20 animate-pulse" : "bg-rose-500 ring-rose-500/20"
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-white/50 tracking-wider uppercase font-semibold mt-0.5">
                Metric: <span className="text-cyan-600 dark:text-cyan-300">{metric === "volume" ? "Volume" : "Temperature"} ({unitLabel})</span>
              </p>
            </div>
          </div>
        </div>

        {/* Top Controls Grid (Glass Controls) */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Quick timeframe selectors */}
          <div className="flex items-center gap-1 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-1 border border-black/[0.06] dark:border-white/[0.06] backdrop-blur-sm">
            {["1D", "7D", "1M", "3M", "1Y"].map((r, i) => {
              const daysMap = [1, 7, 30, 90, 365];
              return (
                <button
                  key={r}
                  onClick={() => setQuickRange(daysMap[i])}
                  className="rounded-lg px-3 py-1.5 text-[10px] font-extrabold transition-all duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"
                >
                  {r}
                </button>
              );
            })}
          </div>

          {/* Frosted Dropdown Selection */}
          <div className="flex items-center gap-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-1 border border-black/[0.06] dark:border-white/[0.06] backdrop-blur-sm">
            <Layers className="h-3.5 w-3.5 text-slate-400 dark:text-white/40 ml-2" />
            <select
              value={resMode}
              onChange={(e: any) => setResMode(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-white/80 outline-none border-none pr-6 cursor-pointer py-1"
            >
              <option value="auto" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">Auto ({activeResolution})</option>
              <option value="1m" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">1 Minute</option>
              <option value="5m" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">5 Minutes</option>
              <option value="15m" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">15 Minutes</option>
              <option value="1h" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">1 Hour</option>
              <option value="1d" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">1 Day</option>
            </select>
          </div>

          {/* Quick reset actions */}
          <button
            onClick={handleResetZoom}
            className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] p-2 text-slate-600 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white transition duration-200 backdrop-blur-sm"
            title="Reset Scope & Resolution"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Escape close button */}
          <button
            onClick={onClose}
            className="rounded-full bg-rose-500/10 border border-rose-500/25 p-2 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25 hover:text-rose-950 dark:hover:text-rose-100 transition-all duration-200 ml-1 shadow-[0_0_15px_rgba(239,68,68,0.05)] dark:shadow-[0_0_15px_rgba(239,68,68,0.1)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Glassmorphic Interactive Chart Canvas */}
      <div className="relative z-10 flex-1 min-h-0 w-full mt-6 bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-2xl overflow-hidden select-none backdrop-blur-md animate-fade-in">
        
        {/* Real-time Status Overlay */}
        <div className="absolute top-5 left-5 z-20 flex flex-wrap gap-2 pointer-events-none">
          {loading && (
            <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-400/25 backdrop-blur-md flex items-center gap-2 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              Re-aggregating data values...
            </span>
          )}
        </div>

        {/* No Data Overlay */}
        {!hasData && !loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-50/40 dark:bg-slate-950/40 backdrop-blur-md">
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
              <AlertTriangle className="h-10 w-10 text-amber-500 dark:text-amber-400 animate-bounce" />
            </div>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">No Data Points Captured</h3>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-1 max-w-sm text-center">
              Try dragging left/right to pan, scrolling the mouse wheel to zoom out, or select a quick timeframe above.
            </p>
          </div>
        )}

        {/* Zoom & Pan Event Canvas Wrapper */}
        <div
          ref={chartContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className={`h-full w-full ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={history}
              margin={{ top: 25, right: 25, left: 15, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.03} vertical={true} />
              
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={domain}
                allowDataOverflow={true}
                tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 600 }}
                tickFormatter={(t) => {
                  const d = new Date(Number(t));
                  const range = domain[1] - domain[0];
                  
                  if (range <= 24 * 60 * 60 * 1000 + 1000) {
                    return d.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }
                  return d.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                  });
                }}
                minTickGap={60}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 600 }}
                width={65}
                domain={metric === "volume" && tank.capacityLiters ? [0, tank.capacityLiters] : [0, "auto"]}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => Number(val).toLocaleString()}
              />

              <Tooltip
                content={<CustomTooltip metric={metric} unitLabel={unitLabel} />}
                cursor={{
                  stroke: "var(--border)",
                  strokeWidth: 1.5,
                  strokeDasharray: "4 4",
                }}
              />

              {/* Min/Max Alarm reference lines */}
              {thresholdLines.min !== undefined && (
                <ReferenceLine
                  y={thresholdLines.min}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Min Limit: ${thresholdLines.min} ${unitLabel}`,
                    fill: "#ef4444",
                    fontSize: 9,
                    fontWeight: 700,
                    position: "right",
                  }}
                />
              )}
              {thresholdLines.max !== undefined && (
                <ReferenceLine
                  y={thresholdLines.max}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Max Limit: ${thresholdLines.max} ${unitLabel}`,
                    fill: "#ef4444",
                    fontSize: 9,
                    fontWeight: 700,
                    position: "right",
                  }}
                />
              )}

              {/* Solid segments - beautiful high density color line */}
              {solidSegments.map((segment, index) => (
                <Line
                  key={`solid-segment-${index}`}
                  name="value"
                  type="monotone"
                  data={segment}
                  dataKey="value"
                  stroke={themeColor}
                  strokeWidth={3.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: "var(--background)",
                    strokeWidth: 2,
                    fill: themeColor,
                  }}
                  connectNulls={false}
                  animationDuration={300}
                />
              ))}

              {/* Gap segments connecting missing data intervals with a RED dotted line */}
              {gapSegments.map((segment, index) => (
                <Line
                  key={`gap-segment-${index}`}
                  name="gap"
                  type="linear"
                  data={segment}
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeOpacity={0.85}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Modern Glassmorphic Stock-Market Footer Panel */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] p-4 rounded-2xl shadow-lg backdrop-blur-md text-[10px] text-slate-500 dark:text-white/50 tracking-wider">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center sm:justify-start">
          <div className="flex items-center gap-2">
            <span>Timeline:</span>
            <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] rounded-xl px-2 py-0.5 shadow-sm backdrop-blur-md hover:border-cyan-500/30 transition duration-200">
              <input
                type="date"
                value={toLocalYYYYMMDD(domain[0])}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-cyan-600 dark:text-cyan-300 outline-none border-none cursor-pointer w-[105px] focus:ring-0"
              />
              <span className="text-slate-400 dark:text-white/30 text-[9px] font-extrabold uppercase px-1">to</span>
              <input
                type="date"
                value={toLocalYYYYMMDD(domain[1])}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-cyan-600 dark:text-cyan-300 outline-none border-none cursor-pointer w-[105px] focus:ring-0"
              />
            </div>
          </div>
          <span className="hidden sm:inline opacity-30">•</span>
          <span>Captured Samples: <b className="text-slate-800 dark:text-white font-bold">{history.length} pts</b></span>
        </div>
        
        <div className="flex items-center gap-3 font-semibold uppercase tracking-widest text-[9px] text-slate-400 dark:text-white/40">
          <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-300">
            <Move className="h-3 w-3" />
            Drag to Pan
          </span>
          <span className="opacity-30">•</span>
          <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-300">
            <ZoomIn className="h-3 w-3" />
            Scroll to Zoom
          </span>
          <span className="opacity-30">•</span>
          <span className="text-rose-500 dark:text-rose-400">ESC to Close</span>
        </div>
      </div>
    </div>
  );
}
