import "server-only";
import {
  createCompany,
  deleteCompany as deleteCompanyDb,
  readCompanies,
} from "@/lib/dbCompanies";

export type Company = {
  id: string;
  name: string;
  logoUrl?: string;
};

export async function getCompanies(): Promise<Company[]> {
  const db = await readCompanies();
  return db.companies.map((c) => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl,
  }));
}

export async function addCompany(input: {
  name: string;
  logoUrl?: string;
}) {
  const base = input.name.trim().toLowerCase().replace(/\s+/g, "");

  const created = await createCompany({
    name: input.name,
    logoUrl: input.logoUrl,
    companyLoginId: `${base}_login`,
    passwordHash: "change-me",
    tanksCount: 1,
    tankCapacities: [1000],
    dataMode: "generated",
  });

  return {
    id: created.id,
    name: created.name,
    logoUrl: created.logoUrl,
  };
}

export async function deleteCompany(id: string) {
  await deleteCompanyDb(id);
}