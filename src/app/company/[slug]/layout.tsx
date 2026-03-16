import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { readCompanies } from "@/lib/dbCompanies";
import { isAdminLoggedIn } from "@/lib/auth";
import { getCompanySessionId } from "@/lib/companyAuth";

type Props = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export default async function CompanySlugLayout({
  children,
  params,
}: Props) {
  const { slug } = await params;

  const db = await readCompanies();
  const company = db.companies.find((c) => c.slug === slug);

  if (!company) {
    notFound();
  }

  const adminLoggedIn = await isAdminLoggedIn();

  // Admin can access any company directly
  if (adminLoggedIn) {
    return <>{children}</>;
  }

  const companySessionId = await getCompanySessionId();

  // No company login -> send to company login
  if (!companySessionId) {
    redirect("/login");
  }

  // Company can access only its own slug
  if (companySessionId !== company.id) {
    redirect("/login");
  }

  return <>{children}</>;
}
