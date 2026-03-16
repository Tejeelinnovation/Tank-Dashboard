import { promises as fs } from "fs";
import path from "path";
import TankGrid from "@/components/tanks/TankGrid";

type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
};

const filePath = path.join(process.cwd(), "src/data/companies.json");

async function getCompanyBySlug(slug: string): Promise<Company | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const db = JSON.parse(raw) as { companies: Company[] };
    return db.companies.find((c) => c.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export default async function CompanyDashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const company = await getCompanyBySlug(params.slug);

  if (!company) {
    return (
      <div className="min-h-screen p-10 text-white">
        <h1 className="text-xl font-semibold">Company not found</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-10 w-28 object-contain rounded bg-white/5 p-1"
            />
          ) : (
            <div className="h-10 w-28 rounded bg-white/5 grid place-items-center text-xs text-white/70">
              NO LOGO
            </div>
          )}

          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-white/60">Tank Dashboard</p>
          </div>
        </div>

        <div className="mt-8">
          {/* your existing tank UI */}
          <TankGrid />
        </div>
      </div>
    </div>
  );
}
