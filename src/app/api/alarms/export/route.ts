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
      SELECT h.created_at as "Time", h.tank_name as "Tank", h.metric as "Metric", 
             h.value as "Value", h.threshold as "Threshold", h.threshold_type as "Type",
             s.volume_unit, s.temperature_unit, s.capacity_liters
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
    
    // Generate CSV
    const rows = res.rows;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const headers = ["Time", "Tank", "Metric", "Value", "Unit", "Threshold", "Type"];
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => {
        let val = row.Value;
        let threshold = row.Threshold;
        let unit = row.Metric === "volume" ? (row.volume_unit || "L") : (row.temperature_unit || "°C");
        
        if (row.Metric === "volume" && typeof val === "number") {
          val = convertFromLiters(val, unit as any, Number(row.capacity_liters || 1000));
          if (typeof threshold === "number") {
            threshold = convertFromLiters(threshold, unit as any, Number(row.capacity_liters || 1000));
          }
        } else if (row.Metric === "temperature" && typeof val === "number") {
          val = convertTemperature(val, "°C", unit as any);
          if (typeof threshold === "number") {
            threshold = convertTemperature(threshold, "°C", unit as any);
          }
        }

        const data: Record<string, any> = {
          Time: row.Time instanceof Date ? row.Time.toISOString() : row.Time,
          Tank: row.Tank,
          Metric: row.Metric,
          Value: typeof val === "number" ? val.toFixed(4) : val,
          Unit: unit,
          Threshold: typeof threshold === "number" ? threshold.toFixed(4) : threshold,
          Type: row.Type
        };

        return headers.map(h => `"${String(data[h]).replace(/"/g, '""')}"`).join(",");
      })
    ].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="alarm_history_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export alarm history:", error);
    return NextResponse.json(
      { error: "Failed to export alarm history" },
      { status: 500 }
    );
  }
}
