import { supabaseAdmin } from "@/lib/supabase-admin";

export type AdminOrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  color?: string;
};

export type AdminAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  dateOrdered: Date | null;
  status: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  items: AdminOrderItem[];
  shippingAddress: AdminAddress;
  billingAddress: AdminAddress;
  paymentMethod: string;
  paymentStatus: string;
  userEmail?: string;
  userName: string;
  userPhone: string;
  trackingNumber: string;
  estimatedDelivery: Date | null;
  userId?: string;
  deliveredAt?: Date | null;
  statusHistory?: { status: string; timestamp: string }[];
};

function parseAddress(raw: unknown): AdminAddress {
  const a = (raw ?? {}) as Record<string, string>;
  return {
    firstName: a.firstName ?? a.first_name ?? "",
    lastName: a.lastName ?? a.last_name ?? "",
    address1: a.address1 ?? "",
    address2: a.address2,
    city: a.city ?? "",
    region: a.region ?? "",
    postalCode: a.postalCode ?? a.postal_code ?? "",
    phone: a.phone ?? "",
  };
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

type OrderRowWithItems = {
  id: string;
  order_number: string;
  user_id: string | null;
  status: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  payment_method: string | null;
  payment_status: string | null;
  date_ordered: string | null;
  date_ordered_client: string | null;
  created_at: string;
  estimated_delivery: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  shipping_address: unknown;
  billing_address: unknown;
  status_history: unknown;
  order_items?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string | null;
    size: string | null;
    color: string | null;
  }[];
};

export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id, order_number, user_id, status, total, subtotal, shipping, tax,
      payment_method, payment_status, date_ordered, date_ordered_client, created_at,
      estimated_delivery, delivered_at, tracking_number, shipping_address, billing_address, status_history,
      order_items (id, name, price, quantity, image, size, color)
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!orders?.length) return [];

  const userIds = [
    ...new Set(
      (orders as OrderRowWithItems[])
        .map((o) => o.user_id)
        .filter(Boolean)
    ),
  ] as string[];

  const { data: users } = userIds.length
    ? await supabaseAdmin.from("users").select("id, email").in("id", userIds)
    : { data: [] as { id: string; email: string }[] };

  const emailByUser = new Map(
    (users ?? []).map((u) => [u.id, u.email] as const)
  );

  return (orders as OrderRowWithItems[]).map((row) => {
    const shippingAddress = parseAddress(row.shipping_address);
    const orderItems = (row.order_items ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      image: i.image ?? "",
      size: i.size ?? undefined,
      color: i.color ?? undefined,
    }));

    return {
      id: row.id,
      orderNumber: row.order_number,
      dateOrdered:
        parseDate(row.date_ordered) ??
        parseDate(row.date_ordered_client) ??
        parseDate(row.created_at),
      status: row.status,
      total: Number(row.total),
      subtotal: Number(row.subtotal),
      shipping: Number(row.shipping),
      tax: Number(row.tax),
      items: orderItems,
      shippingAddress,
      billingAddress: parseAddress(row.billing_address),
      paymentMethod: row.payment_method ?? "",
      paymentStatus: row.payment_status ?? "",
      userEmail: row.user_id ? emailByUser.get(row.user_id) : undefined,
      userName: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
      userPhone: shippingAddress.phone,
      trackingNumber: row.tracking_number ?? "",
      estimatedDelivery: parseDate(row.estimated_delivery),
      userId: row.user_id ?? undefined,
      deliveredAt: parseDate(row.delivered_at),
      statusHistory: Array.isArray(row.status_history)
        ? row.status_history
        : [],
    };
  });
}

export async function updateAdminOrderStatus(
  orderId: string,
  newStatus: string,
  deliveredAt?: string | null
) {
  const { error } = await supabaseAdmin.rpc("update_order_status", {
    p_order_id: orderId,
    p_status: newStatus,
    p_delivered_at:
      newStatus === "delivered"
        ? (deliveredAt ?? new Date().toISOString())
        : null,
    p_mark_received: false,
    p_payment_status: null,
    p_action_completed: null,
  });
  if (error) throw error;
}

export async function countAdminOrders(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("orders")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
