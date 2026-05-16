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
} from "recharts";

type TankMetric = "volume" | "temperature";

type ChartPoint = {
  date: string;
  value: number | null;
  alarm: boolean;
  timestamp: number;
  actualTimestamp?: number;
  carriedForward?: boolean;
};

type Segment = ChartPoint[];

function buildSegments(data: ChartPoint[], dottedThresholdMs: number) {
  const sorted = [...data]
    .filter((p) => typeof p.timestamp === "number")
    .sort((a, b) => a.timestamp - b.timestamp);

  const solidSegments: Segment[] = [];
  const gapSegments: Segment[] = [];

  let currentSolid: Segment = [];
  let lastRealPoint: ChartPoint | null = null;

  for (const point of sorted) {
    const hasValue = typeof point.value === "number";

    if (!hasValue) {
      if (currentSolid.length > 0) {
        solidSegments.push(currentSolid);
        currentSolid = [];
      }
      continue;
    }

    if (lastRealPoint) {
      const gap = point.timestamp - lastRealPoint.timestamp;

      if (gap >= dottedThresholdMs) {
        if (currentSolid.length > 0) {
          solidSegments.push(currentSolid);
        }

        gapSegments.push([lastRealPoint, point]);

        currentSolid = [point];
        lastRealPoint = point;
        continue;
      }
    }

    currentSolid.push(point);
    lastRealPoint = point;
  }

  if (currentSolid.length > 0) {
    solidSegments.push(currentSolid);
  }

  return { solidSegments, gapSegments };
}

function CustomTooltip({
  active,
  label,
  payload,
  metric,
  unitLabel,
}: {
  active?: boolean;
  label?: number | string;
  payload?: any[];
  metric: TankMetric;
  unitLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const validPayload = payload.find(
    (p) =>
      typeof p?.value === "number" &&
      p?.dataKey === "value" &&
      p?.name !== "gap"
  );

  if (!validPayload) return null;

  const point = validPayload.payload as ChartPoint;
  const value = Number(validPayload.value);
  const displayTimestamp = point.actualTimestamp ?? Number(label);
  const date = new Date(displayTimestamp);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        fontSize: 12,
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
        padding: "10px 14px",
        color: "#fff",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.55)",
          marginBottom: 6,
          fontSize: 11,
        }}
      >
        {date.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}
      </div>

      <div style={{ fontWeight: 700 }}>
        {metric === "volume" ? "Volume" : "Temperature"}:{" "}
        {value.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}{" "}
        {unitLabel}
      </div>

      {point.carriedForward && (
        <div
          style={{
            color: "rgba(255,255,255,0.45)",
            marginTop: 4,
            fontSize: 10,
          }}
        >
          carried from previous reading
        </div>
      )}
    </div>
  );
}

export default function TankHistoryChart({
  data,
  metric,
  unitLabel,
  minLine,
  maxLine,
  color,
  capacity,
  xDomain,
}: {
  data: ChartPoint[];
  gapData?: { timestamp: number; value: number | null }[];
  metric: TankMetric;
  unitLabel: string;
  minLine?: number;
  maxLine?: number;
  liveValue?: number;
  liveLabel?: string;
  color?: string;
  capacity?: number;
  xDomain?: [number, number];
}) {
  const chartData = data || [];
  const isEmpty =
    chartData.length === 0 ||
    !chartData.some((p) => typeof p.value === "number");

  const defaultColor = "#3b82f6";
  const themeColor = color || defaultColor;

  const dottedThresholdMs = React.useMemo(() => {
    // Dotted if gap > 1 minute
    return 60 * 1000;
  }, []);

  const { solidSegments, gapSegments } = React.useMemo(
    () => buildSegments(chartData, dottedThresholdMs),
    [chartData, dottedThresholdMs]
  );

  const yDomain = React.useMemo(() => {
    if (metric === "volume" && capacity) return [0, capacity];
    if (metric === "temperature") return [0, 100];
    return [0, 20000];
  }, [metric, capacity]);

  const xTicks = React.useMemo(() => {
    if (!xDomain) return undefined;

    const [start, end] = xDomain;
    const rangeMs = end - start;

    if (rangeMs > 24 * 60 * 60 * 1000 + 1000) {
      return undefined;
    }

    const ticks: number[] = [];
    const hourMs = 60 * 60 * 1000;

    const firstTick = new Date(start);
    firstTick.setMinutes(0, 0, 0);

    let t = firstTick.getTime();

    if (t < start) {
      t += hourMs;
    }

    while (t <= end) {
      ticks.push(t);
      t += hourMs;
    }

    return ticks;
  }, [xDomain]);

  React.useEffect(() => {
    console.log("========== TANK GRAPH DATA ==========");
    console.log("Raw Chart Data:", chartData);
    console.log("Expected Gap MS:", dottedThresholdMs);
    console.log("Solid Segments:", solidSegments);
    console.log("Dotted Gap Segments:", gapSegments);

    console.table(
      chartData.map((d) => ({
        time: new Date(d.timestamp).toLocaleString(),
        actualTime: d.actualTimestamp
          ? new Date(d.actualTimestamp).toLocaleString()
          : "",
        timestamp: d.timestamp,
        value: d.value,
        alarm: d.alarm,
        carriedForward: d.carriedForward,
      }))
    );

    console.log("X Domain:", xDomain);
    console.log("X Ticks:", xTicks);
    console.log("Y Domain:", yDomain);
    console.log("=====================================");
  }, [chartData, solidSegments, gapSegments, xDomain, xTicks, yDomain, dottedThresholdMs]);

  return (
    <div className="relative h-[220px] w-full rounded-2xl border border-black/10 bg-white/50 p-3 transition-colors dark:border-white/10 dark:bg-white/5 sm:h-[280px]">
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/5 backdrop-blur-[1px] dark:bg-black/10">
          <span className="text-sm font-medium text-black/30 dark:text-white/30">
            No data available
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 12, left: 24, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />

          <XAxis
            dataKey="timestamp"
            type="number"
            domain={xDomain || ["auto", "auto"]}
            ticks={xTicks}
            tick={{ fill: "currentColor", fontSize: 10, opacity: 0.5 }}
            tickFormatter={(t) => {
              const d = new Date(Number(t));
              const rangeMs = xDomain ? xDomain[1] - xDomain[0] : 0;

              if (rangeMs > 0 && rangeMs <= 24 * 60 * 60 * 1000 + 1000) {
                return d
                  .toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })
                  .toLowerCase();
              }

              return d.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });
            }}
            minTickGap={45}
            className="text-black dark:text-white"
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: "currentColor", fontSize: 10, opacity: 0.5 }}
            width={50}
            domain={yDomain}
            tickCount={6}
            className="text-black dark:text-white"
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => Number(val).toLocaleString()}
          />

          <Tooltip
            content={<CustomTooltip metric={metric} unitLabel={unitLabel} />}
            cursor={{
              stroke: themeColor,
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          {solidSegments.map((segment, index) => (
            <Line
              key={`solid-segment-${index}`}
              name="value"
              type="linear"
              data={segment}
              dataKey="value"
              stroke={themeColor}
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 5,
                stroke: "#fff",
                strokeWidth: 2,
                fill: themeColor,
                className: "drop-shadow-lg",
              }}
              connectNulls={false}
              animationDuration={800}
            />
          ))}

          {gapSegments.map((segment, index) => (
            <Line
              key={`gap-segment-${index}`}
              name="gap"
              type="linear"
              data={segment}
              dataKey="value"
              stroke={themeColor}
              strokeWidth={3}
              strokeDasharray="5 5"
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
  );
}