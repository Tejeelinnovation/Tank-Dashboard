import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { deleteCompany } from "@/lib/dbCompanies";

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