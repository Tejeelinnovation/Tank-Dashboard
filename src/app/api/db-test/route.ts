import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  try {
    const result = await pool.query("select now() as now");
    return NextResponse.json({
      ok: true,
      now: result.rows[0]?.now ?? null,
    });
  } catch (error) {
    console.error("DB test error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown DB error",
      },
      { status: 500 }
    );
  }
}