import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";

import { AUTH_COOKIE_NAME } from "@/lib/constants";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip auth for static files, api routes, and public pages
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/login") ||
    pathname === "/login" ||
    pathname.startsWith("/public") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  // 2. Get token from cookies
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(req);
  }

  // 3. Verify JWT
  const payload = await verifyJWT(token);
  if (!payload) {
    return redirectToLogin(req);
  }

  // 4. Role-based protection
  if (pathname.startsWith("/admin")) {
    if (payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/company")) {
    const slug = pathname.split("/")[2];
    // Simple check: role must be 'company' or 'user'
    // A more advanced check would compare companyId or slug
    if (payload.role !== "company" && payload.role !== "user") {
       return redirectToLogin(req);
    }
    
    /* 
       Sub-user restriction: we now allow them to access setup, 
       but the Setup page will filter tanks based on their 'edit' permission.
    */
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  // Optional: add callback url
  // loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
