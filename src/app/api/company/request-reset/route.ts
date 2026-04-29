import { NextRequest, NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/companyAuth";
import { updateCompany } from "@/lib/dbCompanies";
import { pool } from "@/lib/postgres";

export async function POST(req: NextRequest) {
  const companySessionId = await getCompanySessionId();
  const body = await req.json().catch(() => ({}));
  const { slug } = body;

  let targetCompanyId: string | null = companySessionId;

  if (!targetCompanyId && slug) {
    const res = await pool.query("select id from companies where slug = $1 limit 1", [slug]);
    targetCompanyId = res.rows[0]?.id || null;
  }

  if (!targetCompanyId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await updateCompany(targetCompanyId, { pwd_reset_requested: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Request reset error:", err);
    return NextResponse.json({ ok: false, error: "Failed to request password reset" }, { status: 500 });
  }
}
