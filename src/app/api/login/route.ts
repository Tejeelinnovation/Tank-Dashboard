import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  isValidAdminCredentials,
  normalizeLoginId,
  setAdminSession,
} from "@/lib/auth";
import {
  clearCompanySession,
  setCompanySession,
} from "@/lib/companyAuth";
import { clearAdminSession } from "@/lib/auth";
import { getCompanyByLoginId } from "@/lib/dbCompanies";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const loginId = normalizeLoginId(String(body?.loginId || ""));
    const password = String(body?.password || "").trim();

    if (!loginId || !password) {
      return NextResponse.json(
        { ok: false, error: "Login ID and password are required" },
        { status: 400 }
      );
    }

    // Admin login
    if (isValidAdminCredentials(loginId, password)) {
      await clearCompanySession();
      await setAdminSession();

      return NextResponse.json({
        ok: true,
        role: "admin",
        redirectTo: "/admin/dashboard",
      });
    }

    // Company login
    const company = await getCompanyByLoginId(loginId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: "Invalid login ID or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, company.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid login ID or password" },
        { status: 401 }
      );
    }

    await clearAdminSession();
    await setCompanySession(company.id);

    return NextResponse.json({
      ok: true,
      role: "company",
      redirectTo: `/company/${company.slug}/setup`,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    });
  } catch (error) {
    console.error("Unified login error:", error);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 }
    );
  }
}