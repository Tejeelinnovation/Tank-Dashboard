"use client";

export type VolumeUnit = "L" | "%" | "m³";
export type TemperatureUnit = "°C" | "°F";
export type TankMetricType = "volume" | "temperature";
export type TankMetricUnit = VolumeUnit | TemperatureUnit;

export type TankMetricConfig = {
  channel: string;
  type: TankMetricType;
  unit: TankMetricUnit;
};

export type TankSetupItem = {
  id: string;
  name: string;
  capacityLiters: number;
  variant?: "rect";
  metrics: [
    { channel: string; type: "volume"; unit: VolumeUnit },
    { channel: string; type: "temperature"; unit: TemperatureUnit }
  ];
};

export type SavedSetup = {
  tanksCount: number;
  tanks: TankSetupItem[];
  updatedAt: string;
};

export const VOLUME_UNITS: VolumeUnit[] = ["L", "%", "m³"];
export const TEMPERATURE_UNITS: TemperatureUnit[] = ["°C", "°F"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function makeDefaultTank(i: number): TankSetupItem {
  return {
    id: `tank-${i + 1}`,
    name: `Tank ${i + 1}`,
    capacityLiters: 1000,
    variant: "rect",
    metrics: [
      {
        channel: `CH${i * 2 + 1}`,
        type: "volume",
        unit: "L",
      },
      {
        channel: `CH${i * 2 + 2}`,
        type: "temperature",
        unit: "°C",
      },
    ],
  };
}

export function normalizeVolumeMetric(
  metric: any,
  fallbackChannel: string
): TankSetupItem["metrics"][0] {
  const unit = VOLUME_UNITS.includes(metric?.unit) ? metric.unit : "L";
  return {
    channel: String(metric?.channel ?? fallbackChannel).trim(),
    type: "volume",
    unit,
  };
}

export function normalizeTemperatureMetric(
  metric: any,
  fallbackChannel: string
): TankSetupItem["metrics"][1] {
  const unit = TEMPERATURE_UNITS.includes(metric?.unit) ? metric.unit : "°C";
  return {
    channel: String(metric?.channel ?? fallbackChannel).trim(),
    type: "temperature",
    unit,
  };
}

export function normalizeTank(
  t: Partial<TankSetupItem> | undefined,
  i: number
): TankSetupItem {
  const metrics = Array.isArray(t?.metrics) ? t.metrics : [];

  return {
    id: t?.id || `tank-${i + 1}`,
    name: t?.name?.trim() || `Tank ${i + 1}`,
    capacityLiters: clamp(Number(t?.capacityLiters) || 1000, 1, 1_000_000),
    variant: "rect",
    metrics: [
      normalizeVolumeMetric(metrics[0], `CH${i * 2 + 1}`),
      normalizeTemperatureMetric(metrics[1], `CH${i * 2 + 2}`),
    ],
  };
}

export function makeDefaultSetup(count = 4): SavedSetup {
  const tanks = Array.from({ length: count }, (_, i) => makeDefaultTank(i));
  return {
    tanksCount: count,
    tanks,
    updatedAt: new Date().toISOString(),
  };
}

export function getVolumeLitersFromMetric(
  rawValue: number,
  tank: TankSetupItem,
  metric: TankSetupItem["metrics"][0]
) {
  if (!Number.isFinite(rawValue)) return 0;

  if (metric.unit === "L") return Math.max(0, rawValue);

  if (metric.unit === "%") {
    if (!(tank.capacityLiters > 0)) return 0;
    return Math.max(0, (rawValue / 100) * tank.capacityLiters);
  }

  if (metric.unit === "m³") {
    return Math.max(0, rawValue * 1000);
  }

  return 0;
}

export function litersToVolumeUnit(
  liters: number,
  tank: Pick<TankSetupItem, "capacityLiters">,
  unit: VolumeUnit
) {
  if (!Number.isFinite(liters)) return 0;

  if (unit === "L") return liters;
  if (unit === "%") {
    if (!(tank.capacityLiters > 0)) return 0;
    return (liters / tank.capacityLiters) * 100;
  }
  if (unit === "m³") return liters / 1000;

  return liters;
}

export function getVolumePercentFromMetric(
  rawValue: number,
  tank: TankSetupItem,
  metric: TankSetupItem["metrics"][0]
) {
  const liters = getVolumeLitersFromMetric(rawValue, tank, metric);
  if (!(tank.capacityLiters > 0)) return 0;
  return clamp((liters / tank.capacityLiters) * 100, 0, 100);
}

export function getTemperatureCFromMetric(
  rawValue: number,
  metric: TankSetupItem["metrics"][1]
) {
  if (!Number.isFinite(rawValue)) return undefined;

  if (metric.unit === "°C") return rawValue;
  if (metric.unit === "°F") return ((rawValue - 32) * 5) / 9;

  return undefined;
}

export function cToTemperatureUnit(valueC: number, unit: TemperatureUnit) {
  if (!Number.isFinite(valueC)) return 0;
  if (unit === "°F") return (valueC * 9) / 5 + 32;
  return valueC;
}

export function getVolumeMetric(tank: TankSetupItem) {
  return tank.metrics[0];
}

export function getTemperatureMetric(tank: TankSetupItem) {
  return tank.metrics[1];
}