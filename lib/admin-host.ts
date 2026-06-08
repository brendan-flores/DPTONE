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

export function isAdminHostname(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  const configured = getAdminHost()?.toLowerCase();
  if (configured && hostname === configured) return true;

  if (process.env.NODE_ENV === "development") {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  return false;
}
