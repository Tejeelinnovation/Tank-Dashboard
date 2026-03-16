import "server-only";
import { cookies } from "next/headers";

export const COOKIE_NAME = "admin_session";

export async function isAdminLoggedIn() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "true";
}

export async function setAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "true", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });
}

export function getAdminLoginId() {
  return String(process.env.ADMIN_LOGIN_ID || "admin").trim().toLowerCase();
}

export function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
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