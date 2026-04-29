export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdminLoggedIn } from "@/lib/auth";
import { pool } from "@/lib/postgres";
import { createCompany, readCompanies, readCompaniesSummary, slugify } from "@/lib/dbCompanies";
import type { Company } from "@/lib/dbCompanies";


function normalizeLoginId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export async function GET() {
  const ok = await isAdminLoggedIn();

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = await readCompaniesSummary();

  return NextResponse.json({
    ok: true,
    companies: db.companies,
  });
}

export async function POST(req: NextRequest) {
  const ok = await isAdminLoggedIn();

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const logoUrl = String(body?.logoUrl || "").trim();
    const requestedLoginId = normalizeLoginId(
      String(body?.companyLoginId || "")
    );
    const tanksCount = Math.max(1, Number(body?.tanksCount || 1));

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Company name is required" },
        { status: 400 }
      );
    }

    if (!requestedLoginId) {
      return NextResponse.json(
        { ok: false, error: "Company Login ID is required" },
        { status: 400 }
      );
    }

    const tankCapacities = Array.isArray(body?.tankCapacities)
      ? body.tankCapacities.map((v: unknown) => Number(v) || 1000)
      : Array.from({ length: tanksCount }, () => 1000);

    const baseSlug = slugify(name) || "company";
    let finalSlug = baseSlug;
    let slugCounter = 2;

    // Check if login ID already exists
    const loginRes = await pool.query("select 1 from companies where company_login_id = $1 limit 1", [requestedLoginId]);
    if (loginRes.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Company Login ID already exists" },
        { status: 400 }
      );
    }

    // Check if slug exists, and iterate if necessary
    let slugExists = true;
    while (slugExists) {
      const slugRes = await pool.query("select 1 from companies where slug = $1 limit 1", [finalSlug]);
      if (slugRes.rows.length === 0) {
          slugExists = false;
      } else {
          finalSlug = `${baseSlug}-${slugCounter}`;
          slugCounter += 1;
      }
    }

    const plainPassword = String(body?.password || "").trim();
    if (!plainPassword) {
      return NextResponse.json(
        { ok: false, error: "Password is required" },
        { status: 400 }
      );
    }
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
    });

    return NextResponse.json({
      ok: true,
      company: created,
    });
  } catch (error: any) {
    console.error("Create company error:", error);

    const message = String(error?.message || "");

    if (
      error?.code === "23505" ||
      message.includes("companies_slug_unique") ||
      message.includes("companies_login_id_unique") ||
      message.includes("companies_slug_key") ||
      message.includes("companies_company_login_id_key")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Slug or Company Login ID already exists",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Failed to create company" },
      { status: 500 }
    );
  }
}