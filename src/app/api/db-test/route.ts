import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  try {
    const res = await pool.query("select now() as time");
    return NextResponse.json({
      ok: true,
      time: res.rows[0]?.time ?? null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "DB connection failed",
      },
      { status: 500 }
    );
  }
}