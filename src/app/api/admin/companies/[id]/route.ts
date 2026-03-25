import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { deleteCompany, updateCompany } from "@/lib/dbCompanies";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminLoggedIn();

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await deleteCompany(id);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminLoggedIn();

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: any = {};
  if (body.hourlyRefreshInterval !== undefined) {
    patch.hourlyRefreshInterval = Number(body.hourlyRefreshInterval);
  }

  const updated = await updateCompany(id, patch);

  if (!updated) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, company: updated });
}