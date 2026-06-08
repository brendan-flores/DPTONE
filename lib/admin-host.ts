/** Admin subdomain — set via NEXT_PUBLIC_ADMIN_HOST (Vercel env / .env.local only; never commit real values). */

export function getAdminHost(): string | null {
  const host = process.env.NEXT_PUBLIC_ADMIN_HOST?.trim();
  return host || null;
}

export function getAdminDashboardUrl(): string {
  const host = getAdminHost();
  if (host) return `https://${host}/admin`;
  if (process.env.NODE_ENV === "development") return "/admin";
  return "/";
}

export function isLocalDevHost(host: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** True only for the configured admin subdomain (e.g. dptone-admin.vercel.app). */
export function isAdminHostname(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  const configured = getAdminHost()?.toLowerCase();
  return Boolean(configured && hostname === configured);
}
