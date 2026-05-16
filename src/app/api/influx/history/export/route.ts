import { NextRequest, NextResponse } from "next/server";
import { queryInflux } from "@/lib/influx";
import { pool } from "@/lib/postgres";
import { convertMaToLiters, convertFromLiters, convertTemperature } from "@/lib/conversions";

const bucket = process.env.INFLUX_BUCKET!;

type InfluxHistoryRow = {
  _time: string;
  _value: number | null;
  channel: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const res = searchParams.get("res") || "daily";
    const tankName = searchParams.get("tankName") || "Tank";
    const slug = searchParams.get("slug");
    const tankKey = searchParams.get("tankKey");

    if (!channel || !start || !end) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 1. Fetch settings if slug/tankKey provided
    let settings: any = null;
    if (slug && tankKey && pool) {
      const companyRes = await pool.query(
        `SELECT id FROM companies WHERE LOWER(slug) = LOWER($1) LIMIT 1`,
        [slug]
      );
      if (companyRes.rows[0]) {
        const tankRes = await pool.query(
          `SELECT * FROM company_tank_settings 
           WHERE company_id = $1 AND TRIM(LOWER(tank_key)) = TRIM(LOWER($2)) LIMIT 1`,
          [companyRes.rows[0].id, tankKey]
        );
        settings = tankRes.rows[0];
      }
    }

    const flux = `
      from(bucket: "${bucket}")
        |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
        |> filter(fn: (r) => r._measurement == "tank_data")
        |> filter(fn: (r) => r._field == "value")
        |> filter(fn: (r) => r.channel == "${channel}")
        |> aggregateWindow(every: ${res === "daily" ? "1d" : "1m"}, fn: last, createEmpty: true)
        |> keep(columns: ["_time", "_value"])
        |> sort(columns: ["_time"])
    `;

    const data = await queryInflux<InfluxHistoryRow>(flux);

    if (data.length === 0) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    // CSV Generation with conversion
    const headers = ["Timestamp", "Value", "Unit"];
    const csvRows = [
      headers.join(","),
      ...data.map(r => {
        let val = r._value;
        let unit = "";

        if (settings && typeof val === "number") {
          const isVol = settings.volume_channel?.trim().toLowerCase() === channel.toLowerCase();
          const isTemp = settings.temperature_channel?.trim().toLowerCase() === channel.toLowerCase();

          if (isVol) {
            unit = settings.volume_unit || "L";
            const cap = Number(settings.capacity_liters || 1000);
            let liters = convertMaToLiters(val, cap, settings.volume_mode);
            // Calibration
            liters = (liters * Number(settings.volume_m ?? 1.0)) + Number(settings.volume_c ?? 0.0);
            // Conversion
            val = convertFromLiters(liters, unit as any, cap);
          } else if (isTemp) {
            unit = settings.temperature_unit || "°C";
            let tempC = 0;
            if (settings.temperature_mode === "percent") tempC = val;
            else if (settings.temperature_mode === "inverted") tempC = 100 - val;
            else tempC = convertTemperature(val, unit as any, "°C");

            // Calibration
            tempC = (tempC * Number(settings.temperature_m ?? 1.0)) + Number(settings.temperature_c ?? 0.0);
            // Conversion
            val = convertTemperature(tempC, "°C", unit as any);
          }
        }

        const displayVal = val !== null ? val.toFixed(4) : "";
        return `"${r._time}","${displayVal}","${unit}"`;
      })
    ];
    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${tankName}_history_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
