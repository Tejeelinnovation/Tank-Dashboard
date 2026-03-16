import { NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";

const bucket = process.env.INFLUX_BUCKET!;

export async function GET() {
  try {
    const flux = `
from(bucket: "${bucket}")
  |> range(start: -365d)
  |> filter(fn: (r) => r._measurement == "tank_data")
  |> filter(fn: (r) => r._field == "value")
  |> group(columns: ["channel"])
  |> last()
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["channel"])
`;

    const rows = await queryInflux<{
      _time: string;
      _value: number;
      channel: string;
    }>(flux);

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch latest Influx data:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest Influx data" },
      { status: 500 }
    );
  }
}