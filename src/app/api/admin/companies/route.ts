import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdminLoggedIn } from "@/lib/auth";
import { createCompany, readCompanies, slugify } from "@/lib/dbCompanies";
import type { Company } from "@/lib/dbCompanies";

function randomPassword(len = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

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

  const db = await readCompanies();

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

    const tankCapacities = Array.isArray(body?.tankCapacities)
      ? body.tankCapacities.map((v: unknown) => Number(v) || 1000)
      : Array.from({ length: tanksCount }, () => 1000);

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

    const db = await readCompanies();

    const baseSlug = slugify(name) || "company";
    let finalSlug = baseSlug;
    let slugCounter = 2;

    while (db.companies.some((c: Company) => c.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${slugCounter}`;
      slugCounter += 1;
    }

    const loginExists = db.companies.some(
      (c: Company) =>
        String(c.companyLoginId).toLowerCase() === requestedLoginId.toLowerCase()
    );

    if (loginExists) {
      return NextResponse.json(
        { ok: false, error: "Company Login ID already exists" },
        { status: 400 }
      );
    }

    const plainPassword = randomPassword(10);
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
      credentials: {
        loginId: requestedLoginId,
        password: plainPassword,
      },
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