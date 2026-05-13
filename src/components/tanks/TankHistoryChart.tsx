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
  timestamp: number;
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
  capacity,
  xDomain,
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
  /** Tank capacity for Y-axis scaling */
  capacity?: number;
  /** X-axis range [min, max] as timestamps */
  xDomain?: [number, number];
}) {
  // Check if dataset is empty
  const isEmpty = !data || data.length === 0;

  const defaultColor = metric === "temperature" ? "#f59e0b" : "#22d3ee";
  const themeColor = color || defaultColor;

  // Check if alarm limit lines exist
  const hasMetricLimits =
    typeof minLine === "number" || typeof maxLine === "number";

  const chartData = data;
  const lineColor = themeColor;

  /**
   * Priority based Y-axis domain:
   * 1. Configured min/max for the relevant tank/sensor (if available)
   * 2. Derived min/max from available data
   * 3. Fallback: 0 to 20000
   */
  const yDomain = React.useMemo(() => {
    if (metric === "volume" && capacity) {
      return [0, capacity];
    }

    if (hasMetricLimits) {
      const lo = typeof minLine === "number" ? minLine : 0;
      const hi = typeof maxLine === "number" ? maxLine : lo + 20000;
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

    return metric === "temperature" ? [0, 100] : [0, 20000];
  }, [data, metric, minLine, maxLine, hasMetricLimits, capacity]);

  // Gradient offsets (0 at top, 1 at bottom)
  const gradientStops = React.useMemo(() => {
    const [yMin, yMax] = yDomain;
    const range = yMax - yMin;
    if (range <= 0) return null;

    const stops = [];
    
    if (typeof maxLine === "number") {
      const off = (yMax - maxLine) / range;
      stops.push({ offset: Math.max(0, off), color: "rgba(255,80,80,1)" }); // Above max is red
      stops.push({ offset: Math.max(0, off), color: lineColor }); // Transition to normal
    }

    if (typeof minLine === "number") {
      const off = (yMax - minLine) / range;
      stops.push({ offset: Math.min(1, off), color: lineColor }); // Normal until min
      stops.push({ offset: Math.min(1, off), color: "rgba(255,80,80,1)" }); // Below min is red
    }

    return stops.length > 0 ? stops : null;
  }, [yDomain, minLine, maxLine, lineColor]);

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
          margin={{ top: 12, right: 12, left: 24, bottom: 8 }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              {gradientStops ? (
                <>
                  <stop offset="0" stopColor={typeof maxLine === "number" ? "rgba(255,80,80,1)" : lineColor} />
                  {gradientStops.map((s, idx) => (
                    <stop key={idx} offset={s.offset} stopColor={s.color} />
                  ))}
                  <stop offset="1" stopColor={typeof minLine === "number" ? "rgba(255,80,80,1)" : lineColor} />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor={lineColor} />
                  <stop offset="1" stopColor={lineColor} />
                </>
              )}
            </linearGradient>
          </defs>

          {/* Grid */}
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />

          {/* X Axis (numeric timestamps) */}
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={xDomain || ['auto', 'auto']}
            tick={{ fill: "currentColor", fontSize: 11, opacity: 0.55 }}
            tickFormatter={(t) => {
              const d = new Date(t);
              const isToday = new Date().toDateString() === d.toDateString();
              
              // If the domain is small (less than 24 hours), show only time
              if (xDomain && (xDomain[1] - xDomain[0]) < 86400000) {
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
              
              // Otherwise show date
              return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }}
            minTickGap={30}
            className="text-black dark:text-white"
          />

          {/* Y Axis with dynamic domain */}
          <YAxis
            tick={{ fill: "currentColor", fontSize: 11, opacity: 0.55 }}
            width={70}
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
              strokeWidth={1.5}
              label={{
                value: `Min: ${minLine}`,
                position: 'insideBottomLeft',
                fill: 'rgba(255,80,80,0.85)',
                fontSize: 10,
                offset: 5
              }}
            />
          )}

          {/* Max reference line */}
          {typeof maxLine === "number" && (
            <ReferenceLine
              y={maxLine}
              stroke="rgba(255,80,80,0.85)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Max: ${maxLine}`,
                position: 'insideTopLeft',
                fill: 'rgba(255,80,80,0.85)',
                fontSize: 10,
                offset: 5
              }}
            />
          )}

          {/* Alarm limits (red dotted lines) */}

          {/* Single continuous line with conditional color gradient */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#lineGradient)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: themeColor }}
            connectNulls={false} 
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}