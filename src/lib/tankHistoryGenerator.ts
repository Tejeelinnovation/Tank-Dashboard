/*export type TankMetric = "volume" | "temperature";

export type TankHistoryPoint = {
  date: string;         // YYYY-MM-DD
  volumeL: number;      // liters
  temperatureC: number; // °C
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function generateTankHistory(params: {
  tankId: string;
  capacityLiters: number;
  startDate: Date;
  endDate: Date;
}): TankHistoryPoint[] {
  const { tankId, capacityLiters, startDate, endDate } = params;

  const seed = hashStringToSeed(tankId);
  const rnd = mulberry32(seed);

  const points: TankHistoryPoint[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const baseTemp = 24 + rnd() * 12; // 24..36
  const dailyTempSwing = 0.6 + rnd() * 1.6; // 0.6..2.2

  let vol = capacityLiters * (0.2 + rnd() * 0.65);
  const driftMax = capacityLiters * (0.02 + rnd() * 0.03); // 2%..5%

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const drift = (rnd() - 0.5) * 2 * driftMax;
    vol = Math.max(0, Math.min(capacityLiters, vol + drift));

    const noise = (rnd() - 0.5) * 0.8;
    const temp = baseTemp + Math.sin(points.length / 5) * dailyTempSwing + noise;

    points.push({
      date: toYmd(new Date(d)),
      volumeL: Math.round(vol),
      temperatureC: Math.round(temp * 10) / 10,
    });
  }

  return points;
}*/
export type TankMetric = "volume" | "temperature";

export type TankHistoryPoint = {
  date: string;
  volumeL: number;
  temperatureC: number;
};