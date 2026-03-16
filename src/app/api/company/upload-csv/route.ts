import { NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/companyAuth";
import { readCompanies, writeCompanies } from "@/lib/dbCompanies";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: Request) {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only CSV allowed" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadDir = path.join(process.cwd(), "src/data/uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const outPath = path.join(uploadDir, `${companyId}.csv`);
  await fs.writeFile(outPath, bytes);

  const db = await readCompanies();
  const idx = db.companies.findIndex((c) => c.id === companyId);
  if (idx !== -1) {
    db.companies[idx].csvPath = outPath;
    await writeCompanies(db);
  }

  return NextResponse.json({ ok: true });
}
