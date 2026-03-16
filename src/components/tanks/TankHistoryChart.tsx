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
  value: number;
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
  const hasMetricLimits =
    typeof minLine === "number" || typeof maxLine === "number";

  const chartData = React.useMemo(() => {
    return (data ?? []).map((p) => ({
      ...p,
      __normal: p.alarm ? null : p.value,
      __alarmSeg: p.alarm ? p.value : null,
    }));
  }, [data]);

  const lineColor =
    metric === "temperature"
      ? "rgba(255,180,90,0.95)"
      : "rgba(120,245,255,0.95)";

  return (
    <div className="h-[220px] w-full rounded-2xl border border-white/10 bg-white/5 p-3 sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />

          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            minTickGap={18}
          />

          <YAxis
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            width={42}
            domain={["auto", "auto"]}
          />

          <Tooltip
            contentStyle={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              color: "white",
              backdropFilter: "blur(10px)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.75)" }}
            formatter={(value: any) => [
              `${value} ${unitLabel}`,
              metric === "volume" ? "Volume" : "Temperature",
            ]}
          />

          {typeof minLine === "number" ? (
            <ReferenceLine
              y={minLine}
              stroke="rgba(255,80,80,0.85)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{
                value: `Min (${minLine}${unitLabel})`,
                position: "insideTopLeft",
                fill: "rgba(255,120,120,0.85)",
                fontSize: 10,
              }}
            />
          ) : null}

          {typeof maxLine === "number" ? (
            <ReferenceLine
              y={maxLine}
              stroke="rgba(255,80,80,0.85)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{
                value: `Max (${maxLine}${unitLabel})`,
                position: "insideTopLeft",
                fill: "rgba(255,120,120,0.85)",
                fontSize: 10,
              }}
            />
          ) : null}

          <Line
            type="monotone"
            dataKey="__normal"
            stroke={lineColor}
            strokeWidth={2.8}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="__alarmSeg"
            stroke="rgba(255,80,80,0.96)"
            strokeWidth={3}
            connectNulls={false}
            isAnimationActive={false}
            dot={(props: any) => {
              const { cx, cy, payload } = props;

              if (!hasMetricLimits) return null;
              if (!payload || payload.__alarmSeg == null) return null;
              if (typeof cx !== "number" || typeof cy !== "number") return null;

              return <circle cx={cx} cy={cy} r={4} fill="rgba(255,80,80,0.96)" />;
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
