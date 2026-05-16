import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  isValidAdminCredentials,
  normalizeLoginId,
  getAdminLoginId,
} from "@/lib/auth";
import { getCompanyByLoginId, getCompanyBySlug } from "@/lib/dbCompanies";
import { getCompanyUserByUsername } from "@/lib/dbUsers";
import { signJWT } from "@/lib/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { pool } from "@/lib/postgres";

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

    let authPayload: any = null;
    let redirectTo = "";

    // 1. Admin login
    if (isValidAdminCredentials(loginId, password)) {
      authPayload = {
        role: "admin",
        username: getAdminLoginId(),
      };
      redirectTo = "/admin/dashboard";
    }

    // 2. Company (Owner) login
    if (!authPayload) {
      const company = await getCompanyByLoginId(loginId);
      if (company && (await bcrypt.compare(password, company.passwordHash))) {
        authPayload = {
          role: "company",
          companyId: company.id,
          username: company.companyLoginId,
          slug: company.slug,
        };
        redirectTo = `/company/${company.slug}/dashboard`;
      }
    }

    // 3. Company User (Sub-user) login
    if (!authPayload) {
      const subUser = await getCompanyUserByUsername(loginId);
      if (subUser && (await bcrypt.compare(password, subUser.passwordHash))) {
        // Fetch company slug for redirect
        const companyRes = await pool.query("SELECT slug FROM companies WHERE id = $1", [subUser.companyId]);
        const slug = companyRes.rows[0]?.slug;

        authPayload = {
          role: "user",
          userId: subUser.id,
          companyId: subUser.companyId,
          username: subUser.username,
          slug,
        };
        redirectTo = `/company/${slug}/dashboard`;
      }
    }

    if (!authPayload) {
      return NextResponse.json(
        { ok: false, error: "Invalid login ID or password" },
        { status: 401 }
      );
    }

    // Issue JWT
    const token = await signJWT(authPayload);

    // Set cookie
    const response = NextResponse.json({
      ok: true,
      role: authPayload.role,
      redirectTo,
      company: authPayload.companyId ? { id: authPayload.companyId, slug: authPayload.slug } : undefined,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Unified login error:", error);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 }
    );
  }
}