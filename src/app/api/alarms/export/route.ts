import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

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
      SELECT created_at as "Time", tank_name as "Tank", metric as "Metric", value as "Value", threshold as "Threshold", threshold_type as "Type"
      FROM tank_alarm_history 
      WHERE company_id = $1
    `;
    const params: any[] = [companyId];

    if (tankKey) {
      params.push(tankKey);
      query += ` AND tank_key = $${params.length}`;
    }

    if (start) {
      params.push(start);
      query += ` AND created_at >= $${params.length}`;
    }

    if (end) {
      params.push(end);
      query += ` AND created_at <= $${params.length}`;
    }

    query += ` ORDER BY created_at ASC`;

    const res = await pool.query(query, params);
    
    // Generate CSV
    const rows = res.rows;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(","),
      ...rows.map(row => 
        headers.map(header => {
          let val = row[header];
          if (val instanceof Date) val = val.toISOString();
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(",")
      )
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
