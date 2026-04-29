import { cookies, headers } from "next/headers";

export const COOKIE_NAME = "admin_session";

export async function isAdminLoggedIn() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME);
    if (token?.value === "true") return true;

    // Fallback: check headers directly
    const heads = await headers();
    const cookieHeader = heads.get("cookie") || "";
    if (cookieHeader.includes(`${COOKIE_NAME}=true`)) {
      return true;
    }
    
    console.log(`[auth] admin session check failed. cookie: ${token?.value}, header: ${cookieHeader ? "present" : "missing"}`);
    return false;
  } catch (err) {
    console.error(`[auth] error checking admin session:`, err);
    return false;
  }
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