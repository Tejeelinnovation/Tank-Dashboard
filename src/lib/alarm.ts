import type { Tank } from "@/components/tanks/TankGrid";
import type { TankAlarmLimits, AlarmMap } from "@/types/alarm";

function extractTankIndex(value?: string) {
  if (!value) return undefined;
  const m = String(value).match(/(?:tank\s*[-_ ]*|^t)(\d+)$/i) ?? String(value).match(/(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeKey(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeLevelPercent(tank: Tank) {
  const raw = Number(tank.level);
  if (!Number.isFinite(raw)) return 0;

  if (raw <= 100) return Math.max(0, Math.min(100, raw));

  const cap =
    typeof tank.capacityLiters === "number" && tank.capacityLiters > 0
      ? tank.capacityLiters
      : 1000;

  return Math.max(0, Math.min(100, (raw / cap) * 100));
}

export function currentVolumeL(tank: Tank) {
  const cap = tank.capacityLiters ?? 1000;
  const pct = normalizeLevelPercent(tank);
  return (pct / 100) * cap;
}

export function pickAlarmLimits(
  map: AlarmMap | Record<string, TankAlarmLimits>,
  tank: Pick<Tank, "id" | "name">
) {
  const directKeys = [tank.id, tank.name].filter(Boolean) as string[];
  for (const key of directKeys) {
    if (map[key]) return map[key];
  }

  const wantedNormalized = new Set(directKeys.map(normalizeKey).filter(Boolean));
  const wantedIndex = extractTankIndex(tank.id) ?? extractTankIndex(tank.name);

  for (const [key, limits] of Object.entries(map)) {
    if (!limits) continue;

    if (wantedNormalized.has(normalizeKey(key))) return limits;

    const entryIndex = extractTankIndex(key);
    if (
      typeof wantedIndex === "number" &&
      typeof entryIndex === "number" &&
      wantedIndex === entryIndex
    ) {
      return limits;
    }
  }

  return undefined;
}

export function getTankAlarmReasons(tank: Tank, limits?: TankAlarmLimits) {
  if (!limits) return [] as string[];

  const reasons: string[] = [];
  const vol = currentVolumeL(tank);
  const temp = typeof tank.temperatureC === "number" ? tank.temperatureC : undefined;

  if (typeof limits.minVolumeL === "number" && vol < limits.minVolumeL) reasons.push("Low Volume");
  if (typeof limits.maxVolumeL === "number" && vol > limits.maxVolumeL) reasons.push("High Volume");

  if (typeof limits.minTempC === "number" && typeof temp === "number" && temp < limits.minTempC) {
    reasons.push("Low Temp");
  }
  if (typeof limits.maxTempC === "number" && typeof temp === "number" && temp > limits.maxTempC) {
    reasons.push("High Temp");
  }

  return reasons;
}

export function isTankInAlarm(tank: Tank, limits?: TankAlarmLimits) {
  return getTankAlarmReasons(tank, limits).length > 0;
}
