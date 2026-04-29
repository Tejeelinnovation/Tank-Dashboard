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

type TankMetric = "volume" | "temperature";

type ChartPoint = {
  date: string;
  value: number | null;
  alarm: boolean;
};

export default function TankHistoryChart({
  data,
  metric,
  unitLabel,
  minLine,
  maxLine,
}: {
  data: ChartPoint[];
  metric: TankMetric;
  unitLabel: string;
  minLine?: number;
  maxLine?: number;
}) {
  // Check if dataset is empty
  const isEmpty = !data || data.length === 0;

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

    const dates = data.map((d) => d.date);

    return dates.map((date) => {
      const found = data.find((d) => d.date === date);

      return {
        date,
        value: found ? found.value : null, // null = no data point
        alarm: found ? found.alarm : false,
      };
    });
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

  // Define line color based on metric
  const lineColor =
    metric === "temperature"
      ? "rgba(255,180,90,0.95)"
      : "rgba(120,245,255,0.95)";

  // Fixed Y-axis domain for consistent layout
  const yDomain =
    metric === "temperature" ? [0, 100] : [0, 5000];

  return (
    <div className="relative h-[220px] w-full rounded-2xl border border-white/10 bg-white/5 p-3 sm:h-[280px]">

      {/* Overlay shown when no data exists */}
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 rounded-2xl backdrop-blur-[1px]">
          <span className="text-white/30 text-sm font-medium">
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
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            minTickGap={18}
          />

          {/* Y Axis with fixed range */}
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            width={42}
            domain={yDomain}
          />

          {/* Tooltip */}
          <Tooltip
            contentStyle={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              color: "white",
            }}
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

          {/* Normal data line (hidden if value is null) */}
          <Line
            type="monotone"
            dataKey="__normal"
            stroke={lineColor}
            strokeWidth={2.8}
            dot={false}
            connectNulls={false} // ensures gaps appear
          />

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