import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_ADMIN_HOST = "dptone-admin.vercel.app";

const ADMIN_ROUTE_SEGMENTS = new Set([
  "add-product",
  "products",
  "orders",
  "activities",
  "analytics",
]);

const PASSTHROUGH_PREFIXES = ["/admin", "/api", "/auth", "/_next"];

function isAdminHost(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  const configured = process.env.NEXT_PUBLIC_ADMIN_HOST?.trim().toLowerCase();
  if (configured && hostname === configured) return true;
  return hostname === DEFAULT_ADMIN_HOST;
}

function adminRedirectPath(pathname: string): string {
  if (pathname === "/") return "/admin";
  if (pathname.startsWith("/admin")) return pathname;

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (firstSegment && ADMIN_ROUTE_SEGMENTS.has(firstSegment)) {
    return `/admin${pathname}`;
  }

  return "/admin";
}

export function middleware(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";

  if (!isAdminHost(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (pathname.includes(".")) {
    return NextResponse.next();
  }

  const target = adminRedirectPath(pathname);
  if (target === pathname) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
