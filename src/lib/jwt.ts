import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_please_change";
const key = new TextEncoder().encode(JWT_SECRET);

export type JWTPayload = {
  userId?: string;
  companyId?: string;
  role: "admin" | "company" | "user";
  username: string;
};

export async function signJWT(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return payload as JWTPayload;
  } catch (err) {
    return null;
  }
}
