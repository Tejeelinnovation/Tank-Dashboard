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
  Label,
} from "recharts";

type TankMetric = "volume" | "temperature";

type ChartPoint = {
  date: string;
  value: number | null;
  alarm: boolean;
};

/**
 * Custom label component for the live-value reference line.
 * Renders a pill-shaped badge with the current reading.
 */
function LiveValueLabel({
  viewBox,
  value,
  unitLabel,
  color,
}: {
  viewBox?: { x?: number; y?: number; width?: number };
  value: number;
  unitLabel: string;
  color: string;
}) {
  if (!viewBox) return null;
  const { y = 0, width = 0, x = 0 } = viewBox;
  const text = `${value} ${unitLabel}`;
  const pillW = Math.max(text.length * 7 + 20, 60);
  const pillH = 22;
  const px = x + width - pillW - 4;
  const py = y - pillH / 2;

  return (
    <g>
      {/* Badge background */}
      <rect
        x={px}
        y={py}
        width={pillW}
        height={pillH}
        rx={pillH / 2}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      {/* Badge text */}
      <text
        x={px + pillW / 2}
        y={py + pillH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={11}
        fontWeight={600}
      >
        ⬤ {text}
      </text>
    </g>
  );
}

export default function TankHistoryChart({
  data,
  metric,
  unitLabel,
  minLine,
  maxLine,
  liveValue,
  liveLabel,
  color,
}: {
  data: ChartPoint[];
  metric: TankMetric;
  unitLabel: string;
  minLine?: number;
  maxLine?: number;
  /** Current live reading to display as a horizontal reference line */
  liveValue?: number;
  /** Override label text (defaults to unitLabel) */
  liveLabel?: string;
  /** Custom color for the graph line */
  color?: string;
}) {
  // Check if dataset is empty
  const isEmpty = !data || data.length === 0;

  const defaultColor = metric === "temperature" ? "#f59e0b" : "#22d3ee";
  const themeColor = color || defaultColor;

  // Check if alarm limit lines exist
  const hasMetricLimits =
    typeof minLine === "number" || typeof maxLine === "number";

  /**
   * Normalize data:
   * - Keeps all dates
   * - Uses null for missing values (creates gaps in chart)
   */
  const normalizedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(p => ({
      date: p.date,
      value: p.value,
      alarm: p.alarm
    }));
  }, [data]);

  /**
   * Prepare chart data:
   * - Separate normal and alarm segments
   * - Prevent rendering values when null
   */
  const chartData = normalizedData.map((p) => ({
    ...p,
    __normal: p.alarm || p.value == null ? null : p.value,
    __alarmSeg: p.alarm && p.value != null ? p.value : null,
  }));

  const lineColor = themeColor;
  const liveLineColor = themeColor;

  /**
   * Priority based Y-axis domain:
   * 1. Configured min/max for the relevant tank/sensor (if available)
   * 2. Derived min/max from available data
   * 3. Fallback: 0 to 20000
   */
  const yDomain = React.useMemo(() => {
    if (hasMetricLimits) {
      const lo = typeof minLine === "number" ? minLine : 0;
      const hi = typeof maxLine === "number" ? maxLine : lo + 20000;
      // Add slight padding
      return [Math.max(0, lo * 0.9), hi * 1.1];
    }
    
    if (data.length > 0) {
      const vals = data.map(d => d.value).filter(v => typeof v === "number") as number[];
      if (vals.length > 0) {
        const minVal = Math.min(...vals);
        const maxVal = Math.max(...vals);
        return [minVal * 0.9, maxVal * 1.1];
      }
    }

    // Default fallbacks
    return metric === "temperature" ? [0, 100] : [0, 20000];
  }, [data, metric, minLine, maxLine, hasMetricLimits]);

  return (
    <div className="relative h-[220px] w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-3 sm:h-[280px] transition-colors">

      {/* Overlay shown when no data exists */}
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 dark:bg-black/10 rounded-2xl backdrop-blur-[1px]">
          <span className="text-black/30 dark:text-white/30 text-sm font-medium">
            No data available
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
        >
          {/* Grid */}
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />

          {/* X Axis (dates) */}
          <XAxis
            dataKey="date"
            tick={{ fill: "currentColor", fontSize: 11, opacity: 0.55 }}
            minTickGap={18}
            className="text-black dark:text-white"
          />

          {/* Y Axis with dynamic domain */}
          <YAxis
            tick={{ fill: "currentColor", fontSize: 11, opacity: 0.55 }}
            width={42}
            domain={yDomain}
            className="text-black dark:text-white"
          />

          {/* Tooltip */}
          <Tooltip
            contentStyle={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              fontSize: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
            }}
            itemStyle={{ color: themeColor }}
            labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: "4px", fontWeight: 500 }}
            formatter={(value: any) => [
              `${value} ${unitLabel}`,
              metric === "volume" ? "Volume" : "Temperature",
            ]}
          />

          {/* Min reference line */}
          {typeof minLine === "number" && (
            <ReferenceLine
              y={minLine}
              stroke="rgba(255,80,80,0.85)"
              strokeDasharray="4 4"
            />
          )}

          {/* Max reference line */}
          {typeof maxLine === "number" && (
            <ReferenceLine
              y={maxLine}
              stroke="rgba(255,80,80,0.85)"
              strokeDasharray="4 4"
            />
          )}

          {/* Live value reference line */}
          {typeof liveValue === "number" && Number.isFinite(liveValue) && (
            <ReferenceLine
              y={liveValue}
              stroke={liveLineColor}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          )}

          {/* Normal data line (hidden if value is null) */}
          <Line
            type="monotone"
            dataKey="__normal"
            stroke={lineColor}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: themeColor }}
            connectNulls={false} // ensures gaps appear
          />
          
          {/* Terminal Live Point Dot */}
          {data.length > 0 && liveValue !== undefined && (
             <Line
              type="monotone"
              data={[data[data.length - 1]]}
              dataKey="value"
              stroke="none"
              dot={{
                r: 4.5,
                fill: themeColor,
                stroke: "#fff",
                strokeWidth: 2,
                className: "drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
              }}
            />
          )}

          {/* Alarm segment line */}
          <Line
            type="monotone"
            dataKey="__alarmSeg"
            stroke="rgba(255,80,80,0.96)"
            strokeWidth={3}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}