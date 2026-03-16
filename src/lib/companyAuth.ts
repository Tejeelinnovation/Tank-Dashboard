import "server-only";
import { cookies } from "next/headers";

const COMPANY_SESSION_COOKIE = "tankco_company_session";

export async function setCompanySession(companyId: string) {
  const cookieStore = await cookies();

  cookieStore.set(COMPANY_SESSION_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
}

export async function clearCompanySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COMPANY_SESSION_COOKIE);
}

export async function getCompanySessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(COMPANY_SESSION_COOKIE)?.value ?? null;
}