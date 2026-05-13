export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { deleteCompany, updateCompany } from "@/lib/dbCompanies";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  const ok = await isAdminLoggedIn();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteCompany(id);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  const ok = await isAdminLoggedIn();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: any = {};

  // name
  if (body.name !== undefined) {
    patch.name = String(body.name).trim();
  }

  // login id
  if (body.companyLoginId !== undefined) {
    patch.companyLoginId = String(body.companyLoginId).trim();
  }

  // tanks count
  if (body.tanksCount !== undefined) {
    patch.tanksCount = Math.max(1, Number(body.tanksCount) || 1);
  }

  // logo (IMPORTANT FIX)
  if (body.logoUrl !== undefined) {
    const val = String(body.logoUrl).trim();
    patch.logoUrl = val || null;
  }

  // influx
  if (body.influxOrg !== undefined) {
    patch.influxOrg = String(body.influxOrg).trim();
  }

  if (body.influxBucket !== undefined) {
    patch.influxBucket = String(body.influxBucket).trim();
  }

  // password update
  if (body.password !== undefined) {
    const pw = String(body.password).trim();
    if (pw) {
      patch.passwordHash = await bcrypt.hash(pw, 10);
      patch.pwd_reset_requested = false;
      patch.pwd_reset_approved = false;
    }
  }

  // reset approval
  if (body.pwd_reset_approved !== undefined) {
    patch.pwd_reset_approved = !!body.pwd_reset_approved;
  }

  const updated = await updateCompany(id, patch);

  if (!updated) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, company: updated });
}