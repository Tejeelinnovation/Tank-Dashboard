"use client";

import * as React from "react";
import { motion, useMotionValue, animate, useAnimationFrame } from "framer-motion";

type Variant = "rect" | "cylinder";
type Surface = "wave" | "flat";
type Accent = "volume" | "temperature";

type FluidTankProps = {
  level: number;
  variant?: Variant;
  width?: number;
  height?: number;
  smoothMs?: number;
  capacityLiters?: number;
  unit?: "L" | "KL";
  alarm?: boolean;
  surface?: Surface;
  displayValue?: number;
  displayUnit?: string;
  accent?: Accent;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatDisplayValue(value: number, unitLabel: string) {
  if (!Number.isFinite(value)) return `-- ${unitLabel}`;
  const digits =
    unitLabel === "m³" || unitLabel === "KL"
      ? 2
      : unitLabel === "%"
      ? 1
      : 1;
  return `${value.toFixed(digits)} ${unitLabel}`;
}

export default function FluidTank({
  level,
  variant = "rect",
  width = 220,
  height = 260,
  smoothMs = 1200,
  capacityLiters = 1000,
  unit = "L",
  alarm = false,
  surface = "wave",
  displayValue,
  displayUnit,
  accent = "volume",
}: FluidTankProps) {
  const pad = 12;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const isCylinder = variant === "cylinder";
  const outerRx = isCylinder ? 22 : 18;
  const innerRx = isCylinder ? 18 : 14;

  const mvLevel = useMotionValue(clamp(level, 0, 100));

  React.useEffect(() => {
    const target = clamp(level, 0, 100);
    const controls = animate(mvLevel, target, {
      duration: smoothMs / 1000,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [level, mvLevel, smoothMs]);

  const uid = React.useId();
  const clipId = `clip-${uid}`;
  const liquidGradId = `liq-${uid}`;
  const tempGradId = `temp-${uid}`;
  const alarmGradId = `alarm-${uid}`;
  const glassId = `glass-${uid}`;
  const glossGradId = `gloss-${uid}`;
  const glowId = `glow-${uid}`;
  const alarmGlowId = `alarm-glow-${uid}`;

  const [frontD, setFrontD] = React.useState("");
  const [backD, setBackD] = React.useState("");
  const [shownPct, setShownPct] = React.useState(clamp(level, 0, 100));

  const litersNow = (shownPct / 100) * capacityLiters;
  const computedDisplayValue = unit === "KL" ? litersNow / 1000 : litersNow;
  const computedDisplayUnit = unit === "KL" ? "kL" : "L";

  const shownValue =
    typeof displayValue === "number" && Number.isFinite(displayValue)
      ? displayValue
      : computedDisplayValue;

  const shownUnit = displayUnit ?? computedDisplayUnit;

  const buildFlatPath = (topY: number) => {
    const x0 = pad;
    const x1 = pad + innerW;
    const yBottom = pad + innerH;
    return `M ${x0} ${topY} L ${x1} ${topY} L ${x1} ${yBottom} L ${x0} ${yBottom} Z`;
  };

  const waveAmp = accent === "temperature" ? 10 : 12;
  const waveLen = 140;
  const speedPxPerSec = accent === "temperature" ? 48 : 40;

  const buildWavePath = (topY: number, phase: number, amp: number) => {
    const startX = -innerW + phase;
    const endX = innerW * 2 + phase;

    let d = `M ${pad + startX} ${topY} `;

    for (let x = startX; x < endX; x += waveLen) {
      const x0 = pad + x;
      const xMid = x0 + waveLen / 2;
      const x1 = x0 + waveLen;

      d += `C ${x0 + waveLen * 0.25} ${topY - amp}, ${x0 + waveLen * 0.25} ${topY - amp}, ${xMid} ${topY} `;
      d += `C ${x0 + waveLen * 0.75} ${topY + amp}, ${x0 + waveLen * 0.75} ${topY + amp}, ${x1} ${topY} `;
    }

    d += `L ${pad + endX} ${pad + innerH} L ${pad + startX} ${pad + innerH} Z`;
    return d;
  };

  useAnimationFrame((t) => {
    const lvlNow = clamp(mvLevel.get(), 0, 100);
    setShownPct(lvlNow);

    const fillH = (lvlNow / 100) * innerH;
    const rawTopY = pad + (innerH - fillH);
    const topMargin = 6;
    const topY = Math.max(pad + topMargin, rawTopY);

    if (surface === "flat") {
      const d = buildFlatPath(topY);
      setBackD(d);
      setFrontD(d);
      return;
    }

    const phase = -((t / 1000) * speedPxPerSec) % waveLen;
    setBackD(buildWavePath(topY + 6, phase * 0.85, waveAmp * 0.55));
    setFrontD(buildWavePath(topY, phase, waveAmp));
  });

  const liquidGradToUse = alarm
    ? alarmGradId
    : accent === "temperature"
    ? tempGradId
    : liquidGradId;

  const outerStroke = alarm
    ? "rgba(255,90,90,0.90)"
    : accent === "temperature"
    ? "rgba(255,165,90,0.42)"
    : "rgba(135,225,255,0.34)";

  const innerStroke = alarm
    ? "rgba(255,70,70,0.85)"
    : accent === "temperature"
    ? "rgba(255,160,90,0.36)"
    : "rgba(120,220,255,0.30)";

  return (
    <div className="relative select-none">
      <svg width={width} height={height} className="block overflow-visible">
        <defs>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={alarmGlowId}>
            <feGaussianBlur stdDeviation="22" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="
                1 0 0 0 0
                0 0.18 0 0 0
                0 0 0.18 0 0
                0 0 0 1 0
              "
            />
          </filter>

          <linearGradient id={glassId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>

          <linearGradient id={liquidGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(130,250,255,0.98)" />
            <stop offset="40%" stopColor="rgba(0,224,255,0.90)" />
            <stop offset="100%" stopColor="rgba(0,105,255,0.84)" />
          </linearGradient>

          <linearGradient id={tempGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,210,90,0.98)" />
            <stop offset="45%" stopColor="rgba(255, 203, 100, 0.92)" />
            <stop offset="100%" stopColor="rgba(255, 160, 65, 0.84)" />
          </linearGradient>

          <linearGradient id={alarmGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,170,170,0.99)" />
            <stop offset="45%" stopColor="rgba(255,70,70,0.96)" />
            <stop offset="100%" stopColor="rgba(185,0,0,0.92)" />
          </linearGradient>

          <linearGradient id={glossGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.00)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
          </linearGradient>

          <clipPath id={clipId}>
            <rect x={pad} y={pad} width={innerW} height={innerH} rx={innerRx} />
          </clipPath>
        </defs>

        {alarm ? (
          <rect
            x={-4}
            y={-4}
            width={width + 8}
            height={height + 8}
            rx={outerRx + 4}
            fill="rgba(255,40,40,0.10)"
            filter={`url(#${alarmGlowId})`}
          />
        ) : null}

        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          rx={outerRx}
          fill={`url(#${glassId})`}
          stroke={outerStroke}
          strokeWidth={alarm ? 2.6 : 2}
        />

        <rect
          x={pad}
          y={pad}
          width={innerW}
          height={innerH}
          rx={innerRx}
          fill="rgba(255,255,255,0.02)"
          stroke={innerStroke}
          strokeWidth={alarm ? 2.2 : 1.4}
        />

        <g clipPath={`url(#${clipId})`}>
          {surface === "wave" ? (
            <motion.path
              d={backD}
              fill={`url(#${liquidGradToUse})`}
              opacity={alarm ? 0.76 : 0.62}
              filter={`url(#${glowId})`}
            />
          ) : null}

          <motion.path
            d={frontD}
            fill={`url(#${liquidGradToUse})`}
            opacity={alarm ? 1 : 0.98}
          />

          <motion.circle
            cx={pad + innerW * 0.72}
            cy={pad + innerH * 0.22}
            r="2.4"
            fill="rgba(255,255,255,0.72)"
            animate={{ y: [0, -12, 0], opacity: [0.22, 0.72, 0.22] }}
            transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx={pad + innerW * 0.32}
            cy={pad + innerH * 0.35}
            r="1.7"
            fill="rgba(255,255,255,0.58)"
            animate={{ y: [0, -14, 0], opacity: [0.16, 0.60, 0.16] }}
            transition={{ duration: 3.9, repeat: Infinity, ease: "easeInOut" }}
          />

          <rect
            x={pad + innerW * 0.12}
            y={pad + 8}
            width={innerW * 0.10}
            height={innerH - 16}
            rx="14"
            fill={`url(#${glossGradId})`}
            opacity={0.7}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={[
            "rounded-full border px-3 py-1 text-xs font-semibold text-white backdrop-blur",
            alarm
              ? "border-red-300/60 bg-red-500/28 shadow-[0_0_18px_rgba(255,70,70,0.28)]"
              : accent === "temperature"
              ? "border-orange-300/35 bg-orange-400/18"
              : "border-cyan-300/30 bg-cyan-300/18",
          ].join(" ")}
        >
          {formatDisplayValue(shownValue, shownUnit)}
        </div>
      </div>
    </div>
  );
}
