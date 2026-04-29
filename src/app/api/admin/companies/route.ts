export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdminLoggedIn } from "@/lib/auth";
import { pool } from "@/lib/postgres";
import { createCompany, readCompaniesSummary, slugify } from "@/lib/dbCompanies";

function normalizeLoginId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export async function GET() {
  const ok = await isAdminLoggedIn();
  if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const db = await readCompaniesSummary();
  return NextResponse.json({ ok: true, companies: db.companies });
}

export async function POST(req: NextRequest) {
  const ok = await isAdminLoggedIn();
  if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const logoUrl = String(body?.logoUrl || "").trim();
    const requestedLoginId = normalizeLoginId(String(body?.companyLoginId || ""));
    const tanksCount = Math.max(1, Number(body?.tanksCount || 1));
    const influxOrg = String(body?.influxOrg || "").trim();
    const influxBucket = String(body?.influxBucket || "").trim();

    if (!name) return NextResponse.json({ ok: false, error: "Company name is required" }, { status: 400 });
    if (!requestedLoginId) return NextResponse.json({ ok: false, error: "Company Login ID is required" }, { status: 400 });
    if (!influxOrg || !influxBucket) return NextResponse.json({ ok: false, error: "Influx Organization and Bucket are required" }, { status: 400 });

    const tankCapacities = Array.isArray(body?.tankCapacities)
      ? body.tankCapacities.map((v: unknown) => Number(v) || 1000)
      : Array.from({ length: tanksCount }, () => 1000);

    const baseSlug = slugify(name) || "company";
    let finalSlug = baseSlug;
    let slugCounter = 2;

    const loginRes = await pool.query("select 1 from companies where company_login_id = $1 limit 1", [requestedLoginId]);
    if (loginRes.rows.length > 0) return NextResponse.json({ ok: false, error: "Company Login ID already exists" }, { status: 400 });

    let slugExists = true;
    while (slugExists) {
      const slugRes = await pool.query("select 1 from companies where slug = $1 limit 1", [finalSlug]);
      if (slugRes.rows.length === 0) slugExists = false;
      else { finalSlug = `${baseSlug}-${slugCounter}`; slugCounter += 1; }
    }

    const plainPassword = String(body?.password || "").trim();
    if (!plainPassword) return NextResponse.json({ ok: false, error: "Password is required" }, { status: 400 });
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const created = await createCompany({
      name,
      slug: finalSlug,
      logoUrl: logoUrl || undefined,
      companyLoginId: requestedLoginId,
      passwordHash,
      tanksCount,
      tankCapacities,
      dataMode: "generated",
      influxOrg,
      influxBucket,
    });

    return NextResponse.json({ ok: true, company: created });
  } catch (error: any) {
    console.error("Create company error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create company" }, { status: 500 });
  }
}