import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";

const bucket = process.env.INFLUX_BUCKET!;

function isValidDateString(v: string) {
  return !Number.isNaN(new Date(v).getTime());
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await context.params;
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();

    if (!channel) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 });
    }

    if (!start || !end || !isValidDateString(start) || !isValidDateString(end)) {
      return NextResponse.json({ error: "valid start and end are required" }, { status: 400 });
    }

    const flux = `
from(bucket: "${bucket}")
  |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
  |> filter(fn: (r) => r._measurement == "tank_data")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.channel == "${channel}")
  |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["_time"])
`;

    const rows = await queryInflux<{
      _time: string;
      _value: number;
      channel: string;
    }>(flux);

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch Influx history:", error);
    return NextResponse.json(
      { error: "Failed to fetch Influx history" },
      { status: 500 }
    );
  }
}