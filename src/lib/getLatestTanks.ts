import "server-only";
import { queryInflux } from "./influx";

const bucket = process.env.INFLUX_BUCKET!;

// Temporary calibration.
// Change these once you confirm each tank/channel scale.
const CHANNEL_CONFIG: Record<
  string,
  { name: string; capacityLiters: number; sensorMax: number; variant?: "rect" | "cylinder" }
> = {
  CH1: { name: "Tank 1", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH2: { name: "Tank 2", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH3: { name: "Tank 3", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH4: { name: "Tank 4", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH5: { name: "Tank 5", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH6: { name: "Tank 6", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH7: { name: "Tank 7", capacityLiters: 1000, sensorMax: 100, variant: "rect" },
  CH8: { name: "Tank 8", capacityLiters: 1000, sensorMax: 100, variant: "rect" },

  // Example for channels that look like raw sensor values in thousands
  CH9: { name: "Tank 9", capacityLiters: 4000, sensorMax: 4000, variant: "rect" },
  CH10: { name: "Tank 10", capacityLiters: 4000, sensorMax: 4000, variant: "rect" },
  CH11: { name: "Tank 11", capacityLiters: 4000, sensorMax: 4000, variant: "rect" },
  CH12: { name: "Tank 12", capacityLiters: 4000, sensorMax: 4000, variant: "rect" },
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getLatestTanks() {
  const flux = `
from(bucket: "${bucket}")
  |> range(start: -15m)
  |> filter(fn: (r) => r._measurement == "tank_data")
  |> filter(fn: (r) => r._field == "value")
  |> last()
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["channel"])
`;

  const rows = await queryInflux<{ _time: string; _value: number; channel: string }>(flux);

  return rows.map((row, index) => {
    const channel = String(row.channel ?? `CH${index + 1}`);
    const rawValue = toNumber(row._value, 0);

    const cfg = CHANNEL_CONFIG[channel] ?? {
      name: `Tank ${channel.replace("CH", "")}`,
      capacityLiters: 1000,
      sensorMax: 100,
      variant: "rect" as const,
    };

    const level = clamp(Math.round((rawValue / cfg.sensorMax) * 100), 0, 100);

    return {
      id: channel,
      name: cfg.name,
      level,
      rawValue,
      lastSeen: row._time,
      capacityLiters: cfg.capacityLiters,
      temperatureC: undefined,
      variant: cfg.variant,
    };
  });
}