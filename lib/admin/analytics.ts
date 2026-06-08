import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchAdminProducts, type AdminProduct } from "@/lib/admin/products";

export type AdminActivity = {
  id: string;
  type: string;
  email: string;
  uid: string;
  timestamp: Date;
  orderId?: string;
  total?: number;
  items?: unknown[];
};

export type SaleRow = {
  id: string;
  total: number;
  quantity: number;
  timestamp: Date;
  items?: unknown;
};

export async function fetchAdminActivities(): Promise<AdminActivity[]> {
  const { data, error } = await supabaseAdmin
    .from("activities")
    .select("id, type, email, user_id, order_id, total, items, created_at")
    .in("type", ["user_created", "purchase"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    email: row.email ?? "",
    uid: row.user_id ?? "",
    timestamp: new Date(row.created_at),
    orderId: row.order_id ?? undefined,
    total: row.total != null ? Number(row.total) : undefined,
    items: row.items ?? undefined,
  }));
}

export async function fetchSalesRows(): Promise<SaleRow[]> {
  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("id, total, quantity, items, timestamp")
    .order("timestamp", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    total: Number(row.total),
    quantity: row.quantity ?? 0,
    timestamp: new Date(row.timestamp),
    items: row.items ?? undefined,
  }));
}

export async function fetchRecentUsers() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function fetchProductReviews() {
  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    productName: r.product_name,
    userEmail: r.user_email,
    rating: r.rating,
    feedback: r.feedback,
    timestamp: new Date(r.created_at),
  }));
}

export async function fetchProductRatingSummaries() {
  const { data, error } = await supabaseAdmin
    .from("product_ratings_summary")
    .select("*")
    .order("average_rating", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.product_id,
    productName: r.product_name,
    averageRating: Number(r.average_rating),
    reviewCount: r.review_count,
  }));
}

export async function fetchReturnsThisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabaseAdmin
    .from("returns")
    .select("price, created_at")
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw error;
  const rows = data ?? [];
  const totalRefunded = rows.reduce(
    (sum, r) => sum + (r.price != null ? Number(r.price) : 0),
    0
  );
  return { count: rows.length, totalRefunded };
}

export function getInventoryInsights(products: AdminProduct[]) {
  const lowStock = products
    .map((p) => {
      if (p.sizes?.length) {
        const lowSizes = p.sizes.filter(
          (s) => Number(s.stock) > 0 && Number(s.stock) <= 5
        );
        if (lowSizes.length) return { ...p, lowStockSizes: lowSizes };
        return null;
      }
      if ((p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 5) return { ...p };
      return null;
    })
    .filter(Boolean);

  const outOfStock = products.filter((p) => {
    if (p.sizes?.length) {
      return !p.sizes.some((s) => Number(s.stock) > 0);
    }
    return !p.totalStock || p.totalStock === 0;
  });

  const bestSelling = products
    .filter((p) => (p.purchasedCount ?? 0) >= 20)
    .map((p) => ({
      name: p.name,
      quantity: p.purchasedCount ?? 0,
      imageUrl: p.imageUrls?.[0] ?? null,
      productId: p.id,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return { lowStock, outOfStock, bestSelling };
}

export async function loadInventoryInsights() {
  const products = await fetchAdminProducts();
  return { products, ...getInventoryInsights(products) };
}

export function sumSalesTotal(sales: SaleRow[]): number {
  return sales.reduce((sum, s) => sum + s.total, 0);
}

function saleQuantity(row: SaleRow): number {
  if (row.quantity) return row.quantity;
  if (Array.isArray(row.items)) {
    return (row.items as { quantity?: number }[]).reduce(
      (sum, item) => sum + (item.quantity ?? 0),
      0
    );
  }
  return 0;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function buildSalesByMonth(sales: SaleRow[]) {
  const byMonth: Record<string, { sales: number; quantity: number }> = {};
  for (const row of sales) {
    const month = row.timestamp.toLocaleString("default", { month: "short" });
    if (!byMonth[month]) byMonth[month] = { sales: 0, quantity: 0 };
    byMonth[month].sales += row.total;
    byMonth[month].quantity += saleQuantity(row);
  }
  return MONTH_LABELS.map((month) => ({
    month,
    sales: byMonth[month]?.sales ?? 0,
    quantity: byMonth[month]?.quantity ?? 0,
  }));
}

export function buildWeeklySales(sales: SaleRow[]) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekly: Record<string, number> = {};
  weekDays.forEach((day) => (weekly[day] = 0));
  for (const row of sales) {
    const date = row.timestamp;
    if (date >= weekStart && date <= weekEnd) {
      weekly[weekDays[date.getDay()]] += row.total;
    }
  }
  return weekDays.map((day) => ({ day, sales: weekly[day] }));
}

export function getAvailableSalesMonths(sales: SaleRow[]) {
  const monthsSet = new Set<string>();
  for (const row of sales) {
    const d = row.timestamp;
    monthsSet.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  return Array.from(monthsSet)
    .map((str) => {
      const [year, month] = str.split("-").map(Number);
      return { month, year };
    })
    .sort((a, b) =>
      b.year !== a.year ? b.year - a.year : b.month - a.month
    )
    .slice(0, 12);
}

export function buildMonthlySalesForMonth(
  sales: SaleRow[],
  year: number,
  month: number
) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const daily: Record<number, number> = {};
  for (let i = 1; i <= daysInMonth; i++) daily[i] = 0;
  for (const row of sales) {
    const date = row.timestamp;
    if (date >= monthStart && date <= monthEnd) {
      daily[date.getDate()] += row.total;
    }
  }
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: (i + 1).toString(),
    sales: daily[i + 1],
  }));
}
