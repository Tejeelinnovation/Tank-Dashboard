import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/postgres";
import { convertFromLiters, convertTemperature } from "@/lib/conversions";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const tankKey = searchParams.get("tankKey");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const companyRes = await pool.query(
      `SELECT id FROM companies WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    const company = companyRes.rows[0];
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = company.id;

    let query = `
      SELECT h.*, s.volume_unit, s.temperature_unit, s.capacity_liters
      FROM tank_alarm_history h
      LEFT JOIN company_tank_settings s ON TRIM(LOWER(h.tank_key)) = TRIM(LOWER(s.tank_key)) AND h.company_id = s.company_id
      WHERE h.company_id = $1
    `;
    const params: any[] = [companyId];

    if (tankKey) {
      params.push(tankKey);
      query += ` AND h.tank_key = $${params.length}`;
    }

    if (start) {
      params.push(start);
      query += ` AND h.created_at >= $${params.length}`;
    }

    if (end) {
      params.push(end);
      query += ` AND h.created_at <= $${params.length}`;
    }

    query += ` ORDER BY h.created_at ASC`;

    const res = await pool.query(query, params);
    
    // Convert values
    const rows = res.rows.map(row => {
      let val = Number(row.value);
      let threshold = Number(row.threshold);
      let unit = row.metric === "volume" ? (row.volume_unit || "L") : (row.temperature_unit || "°C");

      if (row.metric === "volume") {
        val = convertFromLiters(val, unit as any, Number(row.capacity_liters || 1000));
        threshold = convertFromLiters(threshold, unit as any, Number(row.capacity_liters || 1000));
      } else if (row.metric === "temperature") {
        val = convertTemperature(val, "°C", unit as any);
        threshold = convertTemperature(threshold, "°C", unit as any);
      }

      return {
        ...row,
        Time: row.created_at,
        Tank: row.tank_name,
        Metric: row.metric,
        Value: val,
        Threshold: threshold,
        Type: row.threshold_type,
        Unit: unit
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch alarm history:", error);
    return NextResponse.json(
      { error: "Failed to fetch alarm history" },
      { status: 500 }
    );
  }
}
