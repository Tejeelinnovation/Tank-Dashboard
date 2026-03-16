import { NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/companyAuth";
import { readCompanies } from "@/lib/dbCompanies";
import { promises as fs } from "fs";
import { parse } from "csv-parse/sync";

type DataMode = "generated" | "csv" | "disabled";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function generate(n: number, caps: number[]) {
  return Array.from({ length: n }, (_, i) => {
    const cap = caps[i] ?? 1000;
    // level as liters -> convert to % if you want later
    const levelLiters = Math.round(Math.random() * cap);
    const temp = Math.round((24 + Math.random() * 16) * 10) / 10;

    return {
      id: `T${i + 1}`,
      name: `Tank ${i + 1}`,
      level: clamp(Math.round((levelLiters / cap) * 100), 0, 100), // percent
      temperatureC: temp,
      capacityLiters: cap,
    };
  });
}

export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await readCompanies();
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const tanksCount = company.tanksCount ?? 4;
  const caps = company.tankCapacities ?? Array.from({ length: tanksCount }, () => 1000);
  const mode: DataMode = company.dataMode ?? "generated";

  if (mode === "disabled") {
    return NextResponse.json({ mode, tanks: [] });
  }

  // CSV mode
  if (mode === "csv" && company.csvPath) {
    const csvText = await fs.readFile(company.csvPath, "utf-8");

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];

    // Use first N rows as tanks
    const tanks = Array.from({ length: tanksCount }, (_, i) => {
      const r = rows[i] ?? {};
      const cap = caps[i] ?? 1000;

      const name = String(r.TankName ?? `Tank ${i + 1}`);
      const levelVal = Number(r.Level ?? 0); // assume Level is % in CSV
      const tempVal = Number(r.Temp ?? 0);

      return {
        id: `T${i + 1}`,
        name,
        level: clamp(Math.round(levelVal), 0, 100),
        temperatureC: Number.isFinite(tempVal) ? tempVal : undefined,
        capacityLiters: cap,
      };
    });

    return NextResponse.json({ mode, tanks });
  }

  // Generated mode
  const tanks = generate(tanksCount, caps);
  return NextResponse.json({ mode: "generated", tanks });
}
