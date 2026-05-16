import { cookies } from "next/headers";
import { verifyJWT } from "./jwt";
import { AUTH_COOKIE_NAME } from "@/lib/constants";

export async function isAdminLoggedIn() {
  try {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return false;

    const payload = await verifyJWT(token);
    return payload?.role === "admin";
  } catch (err) {
    return false;
  }
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
}

export function getAdminLoginId() {
  return String(process.env.ADMIN_LOGIN_ID || "admin").trim().toLowerCase();
}

export function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "admin").trim();
}

export function normalizeLoginId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function isValidAdminCredentials(loginId: string, password: string) {
  return (
    normalizeLoginId(loginId) === getAdminLoginId() &&
    password.trim() === getAdminPassword()
  );
}