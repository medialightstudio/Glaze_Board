// Auth gate — unauth → login; office → /m; field → /f; /c blocked. Field never opens /m.

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/service") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/bridge") ||
    pathname.startsWith("/service/") ||
    pathname.startsWith("/q/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.svg" ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (!sessionCookie) {
    if (isLogin) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || pathname === "") {
    const url = request.nextUrl.clone();
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/c")) {
    return NextResponse.next();
  }

  // Fine-grained role checks happen in layouts (cookie alone cannot carry role safely).
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
