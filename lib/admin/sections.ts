export const ADMIN_SECTIONS = [
  {
    slug: "add-product",
    label: "Add Product",
    href: "/admin/add-product",
  },
  {
    slug: "products",
    label: "Manage Products",
    href: "/admin/products",
  },
  {
    slug: "orders",
    label: "Manage Orders",
    href: "/admin/orders",
  },
  {
    slug: "activities",
    label: "Recent Activities",
    href: "/admin/activities",
  },
  {
    slug: "analytics",
    label: "View Analytics",
    href: "/admin/analytics",
  },
] as const;

export type AdminSectionSlug = (typeof ADMIN_SECTIONS)[number]["slug"];

export function getActiveAdminSection(pathname: string): AdminSectionSlug {
  const match = ADMIN_SECTIONS.find((s) => pathname.startsWith(s.href));
  return match?.slug ?? "add-product";
}
