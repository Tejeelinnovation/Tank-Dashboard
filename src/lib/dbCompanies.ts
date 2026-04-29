import "server-only";
import { pool } from "@/lib/postgres";

export type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;

  companyLoginId: string;
  passwordHash: string;

  tanksCount: number;
  tankCapacities: number[];

  csvPath?: string;
  dataMode: "generated" | "csv" | "disabled";
  pwd_reset_requested?: boolean;
  pwd_reset_approved?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function mapCompanyRow(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? "",
    companyLoginId: row.company_login_id,
    passwordHash: row.password_hash,
    tanksCount: Number(row.tanks_count ?? 1),
    tankCapacities: Array.isArray(row.tank_capacities)
      ? row.tank_capacities.map((v: unknown) => Number(v))
      : [],
    csvPath: row.csv_path ?? "",
    dataMode: row.data_mode,
    pwd_reset_requested: !!row.pwd_reset_requested,
    pwd_reset_approved: !!row.pwd_reset_approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function readCompanies(): Promise<{ companies: Company[] }> {
  const res = await pool.query(
    `select * from companies order by created_at desc`
  );

  return {
    companies: res.rows.map(mapCompanyRow),
  };
}

/**
 * Lightweight version of readCompanies for the admin dashboard list. 
 * Excludes heavy or sensitive fields like passwordHash and tankCapacities.
 */
export async function readCompaniesSummary(): Promise<{ companies: Partial<Company>[] }> {
  const res = await pool.query(
    `select id, name, slug, logo_url, company_login_id, tanks_count, data_mode, pwd_reset_requested, pwd_reset_approved, created_at 
     from companies 
     order by created_at desc`
  );

  return {
    companies: res.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url ?? "",
      companyLoginId: row.company_login_id,
      tanksCount: Number(row.tanks_count ?? 0),
      dataMode: row.data_mode,
      pwd_reset_requested: !!row.pwd_reset_requested,
      pwd_reset_approved: !!row.pwd_reset_approved,
      createdAt: row.created_at
    })),
  };
}

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const res = await pool.query(
    `select * from companies where slug = $1 limit 1`,
    [slug]
  );

  return res.rows[0] ? mapCompanyRow(res.rows[0]) : null;
}

export async function getCompanyByLoginId(
  companyLoginId: string
): Promise<Company | null> {
  const res = await pool.query(
    `select * from companies where company_login_id = $1 limit 1`,
    [companyLoginId]
  );

  return res.rows[0] ? mapCompanyRow(res.rows[0]) : null;
}

export async function createCompany(input: {
  name: string;
  slug?: string;
  logoUrl?: string;
  companyLoginId: string;
  passwordHash: string;
  tanksCount?: number;
  tankCapacities?: number[];
  csvPath?: string;
  dataMode?: "generated" | "csv" | "disabled";
}): Promise<Company> {
  const slug = input.slug?.trim() || slugify(input.name);

  const res = await pool.query(
    `
    insert into companies (
      name, slug, logo_url, company_login_id, password_hash,
      tanks_count, tank_capacities, csv_path, data_mode, pwd_reset_requested, pwd_reset_approved
    )
    values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9, $10, $11)
    returning *
    `,
    [
      input.name.trim(),
      slug,
      input.logoUrl?.trim() || null,
      input.companyLoginId.trim(),
      input.passwordHash,
      input.tanksCount ?? 1,
      JSON.stringify(input.tankCapacities ?? []),
      input.csvPath?.trim() || null,
      input.dataMode ?? "generated",
      false,
      false
    ]
  );

  return mapCompanyRow(res.rows[0]);
}

export async function updateCompany(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    logoUrl: string;
    companyLoginId: string;
    passwordHash: string;
    tanksCount: number;
    tankCapacities: number[];
    csvPath: string;
    dataMode: "generated" | "csv" | "disabled";
    pwd_reset_requested: boolean;
    pwd_reset_approved: boolean;
  }>
): Promise<Company | null> {
  const currentRes = await pool.query(
    `select * from companies where id = $1 limit 1`,
    [id]
  );

  const current = currentRes.rows[0];
  if (!current) return null;

  const res = await pool.query(
    `
    update companies
    set
      name = $2,
      slug = $3,
      logo_url = $4,
      company_login_id = $5,
      password_hash = $6,
      tanks_count = $7,
      tank_capacities = $8::jsonb,
      csv_path = $9,
      data_mode = $10,
      pwd_reset_requested = $11,
      pwd_reset_approved = $12,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      id,
      input.name?.trim() ?? current.name,
      input.slug?.trim() ?? current.slug,
      input.logoUrl?.trim() ?? current.logo_url,
      input.companyLoginId?.trim() ?? current.company_login_id,
      input.passwordHash ?? current.password_hash,
      input.tanksCount ?? current.tanks_count,
      JSON.stringify(input.tankCapacities ?? current.tank_capacities ?? []),
      input.csvPath?.trim() ?? current.csv_path,
      input.dataMode ?? current.data_mode,
      input.pwd_reset_requested ?? current.pwd_reset_requested,
      input.pwd_reset_approved ?? current.pwd_reset_approved,
    ]
  );

  return mapCompanyRow(res.rows[0]);
}

export async function deleteCompany(id: string) {
  await pool.query(`delete from companies where id = $1`, [id]);
}