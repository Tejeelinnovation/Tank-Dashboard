export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";
import { pool } from "@/lib/postgres";

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
      return NextResponse.json(
        { error: "channel is required" },
        { status: 400 }
      );
    }

    // Security check
    if (pool) {
      try {
        const disabledCheck = await pool.query(
          `SELECT disable_volume, disable_temperature, volume_channel, temperature_channel
           FROM company_tank_settings
           WHERE volume_channel = $1 OR temperature_channel = $1`,
          [channel]
        );

        if (disabledCheck.rows.length > 0) {
          const row = disabledCheck.rows[0];

          const isVolMatch = row.volume_channel === channel;
          const isTempMatch = row.temperature_channel === channel;

          if (
            (isVolMatch && row.disable_volume) ||
            (isTempMatch && row.disable_temperature)
          ) {
            return NextResponse.json({
              rows: [],
              warning: "Metric is disabled in company settings",
            });
          }
        }
      } catch (dbErr) {
        console.error("DB check failed in history API:", dbErr);
      }
    }

    if (
      !start ||
      !end ||
      !isValidDateString(start) ||
      !isValidDateString(end)
    ) {
      return NextResponse.json(
        { error: "valid start and end are required" },
        { status: 400 }
      );
    }

    const resolution = searchParams.get("res") || "daily";

    let flux = `
from(bucket: "${bucket}")
  |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
  |> filter(fn: (r) => r._measurement == "tank_data")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.channel == "${channel}")
`;

    // Daily mode -> 1 hour points
    // Time mode -> 15 minute points
    if (resolution === "daily") {
      flux += `
  |> aggregateWindow(every: 1h, fn: last, createEmpty: false)
`;
    } else {
      flux += `
  |> aggregateWindow(every: 15m, fn: last, createEmpty: false)
`;
    }

    flux += `
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["_time"])
`;

    console.log("========== HISTORY QUERY ==========");
    console.log({
      channel,
      resolution,
      start,
      end,
    });
    console.log(flux);
    console.log("===================================");

    const rows = await queryInflux<{
      _time: string;
      _value: number;
      channel: string;
    }>(flux);

    console.log("========== HISTORY RESULT ==========");
    console.log({
      totalRows: rows.length,
      firstRow: rows[0],
      lastRow: rows[rows.length - 1],
    });

    console.table(
      rows.slice(0, 20).map((r) => ({
        time: r._time,
        value: r._value,
      }))
    );

    console.log("====================================");

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch Influx history:", error);

    return NextResponse.json(
      { error: "Failed to fetch Influx history" },
      { status: 500 }
    );
  }
}