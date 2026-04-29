export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";

const defaultBucket = process.env.INFLUX_BUCKET!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const org = searchParams.get("org") || undefined;
    const bucket = searchParams.get("bucket") || defaultBucket;

    if (!bucket) {
      return NextResponse.json({ error: "Influx Bucket is required" }, { status: 400 });
    }

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
    }>(flux, org);

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch latest Influx data:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest Influx data" },
      { status: 500 }
    );
  }
}