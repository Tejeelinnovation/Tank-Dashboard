import "server-only";
import { cookies } from "next/headers";
import { verifyJWT } from "./jwt";
import { AUTH_COOKIE_NAME } from "@/lib/constants";

export async function clearCompanySession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getCompanySessionId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  return payload?.companyId ?? null;
}

export async function getUserSessionId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  return payload?.userId ?? null;
}

export async function getSessionRole() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  return payload?.role ?? null;
}