import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminHostname, isLocalDevHost } from "@/lib/admin-host";

const ADMIN_ROUTE_SEGMENTS = new Set([
  "add-product",
  "products",
  "orders",
  "activities",
  "analytics",
]);

const PASSTHROUGH_PREFIXES = ["/api", "/auth", "/_next"];

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

  const { pathname } = request.nextUrl;
  const onAdminHost = isAdminHostname(host);
  const isAdminPath = pathname.startsWith("/admin");
  const localDev = isLocalDevHost(host);

  // Production storefront: block /admin. Local dev: / → storefront, /admin → admin.
  if (!onAdminHost && !localDev && isAdminPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!onAdminHost) {
    return NextResponse.next();
  }

  if (
    isAdminPath ||
    PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
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
