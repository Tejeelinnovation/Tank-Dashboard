export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { deleteCompany, updateCompany } from "@/lib/dbCompanies";
import { cookies } from "next/headers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await isAdminLoggedIn();

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteCompany(id);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await isAdminLoggedIn();

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const patch: any = {};
  
  if (body.password !== undefined) {
    const pw = String(body.password).trim();
    if(pw) {
      patch.passwordHash = await bcrypt.hash(pw, 10);
      patch.pwd_reset_requested = false;
      patch.pwd_reset_approved = false;
    }
  }

  if (body.pwd_reset_approved !== undefined) {
    patch.pwd_reset_approved = !!body.pwd_reset_approved;
  }


  const updated = await updateCompany(id, patch);

  if (!updated) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, company: updated });
}