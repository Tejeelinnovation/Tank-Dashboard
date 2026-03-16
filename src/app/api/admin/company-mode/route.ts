import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { updateCompany } from "@/lib/dbCompanies";

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

    const companyId = String(body?.companyId || "").trim();
    const dataMode = String(body?.dataMode || "").trim();

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: "Company ID is required" },
        { status: 400 }
      );
    }

    if (!["generated", "csv", "disabled"].includes(dataMode)) {
      return NextResponse.json(
        { ok: false, error: "Invalid data mode" },
        { status: 400 }
      );
    }

    const updated = await updateCompany(companyId, {
      dataMode: dataMode as "generated" | "csv" | "disabled",
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, company: updated });
  } catch (error) {
    console.error("Company mode update error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update mode" },
      { status: 500 }
    );
  }
}