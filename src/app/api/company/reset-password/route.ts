import { NextRequest, NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/companyAuth";
import { isAdminLoggedIn } from "@/lib/auth";
import { updateCompany } from "@/lib/dbCompanies";
import { pool } from "@/lib/postgres";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const companySessionId = await getCompanySessionId();
  const adminLoggedIn = await isAdminLoggedIn();
  
  const body = await req.json().catch(() => ({}));
  const { password, slug } = body;

  let targetCompanyId: string | null = companySessionId;

  // If admin is logged in and providing a slug, resolve that company
  if (!targetCompanyId && adminLoggedIn && slug) {
    const res = await pool.query("select id from companies where slug = $1 limit 1", [slug]);
    targetCompanyId = res.rows[0]?.id || null;
  }

  if (!targetCompanyId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!password || password.length < 4) {
      return NextResponse.json({ ok: false, error: "Password too short" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await updateCompany(targetCompanyId, {
      passwordHash,
      pwd_reset_requested: false,
      pwd_reset_approved: false
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return NextResponse.json({ ok: false, error: "Failed to reset password" }, { status: 500 });
  }
}
