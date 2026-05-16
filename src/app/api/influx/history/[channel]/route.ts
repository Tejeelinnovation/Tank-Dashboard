export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";
import { pool } from "@/lib/postgres";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { verifyJWT } from "@/lib/jwt";
import { getUserPermittedChannels } from "@/lib/dbUsers";

const bucket = process.env.INFLUX_BUCKET!;

type InfluxHistoryRow = {
  _time: string;
  _value: number | null;
  channel: string;
};

function isValidDateString(v: string) {
  return !Number.isNaN(new Date(v).getTime());
}

function baseFlux(channel: string) {
  return `
  |> filter(fn: (r) => r._measurement == "tank_data")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.channel == "${channel}")
`;
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
    
    // Auth check
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifyJWT(token) : null;
    const isSubUser = session?.role === "user";

    if (isSubUser && session?.userId) {
      const permitted = await getUserPermittedChannels(session.userId);
      if (!permitted.includes(channel.trim())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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

          if ((isVolMatch && row.disable_volume) || (isTempMatch && row.disable_temperature)) {
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

    if (!start || !end || !isValidDateString(start) || !isValidDateString(end)) {
      return NextResponse.json({ error: "valid start and end are required" }, { status: 400 });
    }

    const resolution = searchParams.get("res") || "daily";

    if (resolution === "daily") {
      const flux = `
from(bucket: "${bucket}")
  |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
${baseFlux(channel)}
  |> aggregateWindow(every: 1d, fn: last, createEmpty: true)
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["_time"])
`;

      console.log("========== DAILY FLUX QUERY ==========");
      console.log(flux);
      console.log("====================================");

      const rows = await queryInflux<InfluxHistoryRow>(flux);

      console.log("========== DAILY INFLUX RESULT ==========");
      console.log({
        channel,
        resolution,
        start,
        end,
        totalRows: rows.length,
        validRows: rows.filter((r) => r._value !== null && r._value !== undefined).length,
        firstRow: rows[0] ?? null,
        lastRow: rows[rows.length - 1] ?? null,
      });
      console.log("=======================================");

      return NextResponse.json({ rows });
    }

    const previousFlux = `
from(bucket: "${bucket}")
  |> range(start: -90d, stop: time(v: "${start}"))
${baseFlux(channel)}
  |> last()
  |> keep(columns: ["_time", "_value", "channel"])
`;

    const currentFlux = `
from(bucket: "${bucket}")
  |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
${baseFlux(channel)}
  |> aggregateWindow(every: 1m, fn: last, createEmpty: true)
  |> keep(columns: ["_time", "_value", "channel"])
  |> sort(columns: ["_time"])
`;

    console.log("========== TIME PREVIOUS FLUX QUERY ==========");
    console.log(previousFlux);
    console.log("=============================================");
    console.log("========== TIME CURRENT FLUX QUERY ==========");
    console.log(currentFlux);
    console.log("============================================");

    const [previousRows, currentRows] = await Promise.all([
      queryInflux<InfluxHistoryRow>(previousFlux),
      queryInflux<InfluxHistoryRow>(currentFlux),
    ]);

    const previousValidRows = previousRows.filter(
      (r) => r._value !== null && r._value !== undefined && !Number.isNaN(Number(r._value))
    );

    const rows = [...previousValidRows.slice(-1), ...currentRows].sort(
      (a, b) => new Date(a._time).getTime() - new Date(b._time).getTime()
    );

    const validRows = rows.filter(
      (r) => r._value !== null && r._value !== undefined && !Number.isNaN(Number(r._value))
    );

    console.log("========== TIME INFLUX RESULT ==========");
    console.log({
      channel,
      resolution,
      start,
      end,
      previousRows: previousRows.length,
      previousValidRows: previousValidRows.length,
      currentRows: currentRows.length,
      totalRows: rows.length,
      validRows: validRows.length,
      previousCarryRow: previousValidRows.at(-1) ?? null,
      firstRow: rows[0] ?? null,
      lastRow: rows[rows.length - 1] ?? null,
    });
    console.table(
      validRows.slice(0, 30).map((r) => ({
        time: r._time,
        value: r._value,
      }))
    );
    console.log("======================================");

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch Influx history:", error);
    return NextResponse.json(
      { error: "Failed to fetch Influx history" },
      { status: 500 }
    );
  }
}
