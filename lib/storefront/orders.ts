import { supabase } from "@/lib/supabase";

export type StorefrontOrderItem = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  color?: string;
};

export type StorefrontAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
};

export type StatusHistoryEntry = {
  status: string;
  timestamp: string;
};

export type StorefrontOrder = {
  id: string;
  orderNumber: string;
  dateOrdered: Date | null;
  status: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  items: StorefrontOrderItem[];
  shippingAddress: StorefrontAddress;
  billingAddress?: StorefrontAddress;
  paymentMethod: string;
  paymentStatus: string;
  trackingNumber?: string;
  estimatedDelivery?: Date | null;
  deliveredAt?: Date | null;
  orderReceived?: boolean;
  actionCompleted?: boolean;
  notes?: string;
  statusHistory: StatusHistoryEntry[];
};

const ORDER_SELECT = `
  id, order_number, status, total, subtotal, shipping, tax,
  payment_method, payment_status,
  date_ordered, date_ordered_client, created_at,
  estimated_delivery, delivered_at, tracking_number,
  shipping_address, billing_address, order_received, action_completed,
  notes, status_history,
  order_items (id, product_id, name, price, quantity, image, size, color)
`;

function parseAddress(raw: unknown): StorefrontAddress {
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

function parseStatusHistory(raw: unknown): StatusHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const e = entry as Record<string, unknown>;
      const status = typeof e.status === "string" ? e.status : "";
      const timestamp =
        typeof e.timestamp === "string"
          ? e.timestamp
          : e.timestamp != null
            ? String(e.timestamp)
            : "";
      return { status, timestamp };
    })
    .filter((e) => e.status);
}

type OrderRow = {
  id: string;
  order_number: string;
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
  order_received: boolean;
  action_completed: boolean;
  notes: string | null;
  status_history: unknown;
  order_items?: {
    id: string;
    product_id: string | null;
    name: string;
    price: number;
    quantity: number;
    image: string | null;
    size: string | null;
    color: string | null;
  }[];
};

function mapOrderRow(row: OrderRow): StorefrontOrder {
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
    items: (row.order_items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id ?? undefined,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      image: i.image ?? "",
      size: i.size ?? undefined,
      color: i.color ?? undefined,
    })),
    shippingAddress: parseAddress(row.shipping_address),
    billingAddress: parseAddress(row.billing_address),
    paymentMethod: row.payment_method ?? "",
    paymentStatus: row.payment_status ?? "pending",
    trackingNumber: row.tracking_number ?? undefined,
    estimatedDelivery: parseDate(row.estimated_delivery),
    deliveredAt: parseDate(row.delivered_at),
    orderReceived: row.order_received,
    actionCompleted: row.action_completed,
    notes: row.notes ?? undefined,
    statusHistory: parseStatusHistory(row.status_history),
  };
}

export async function fetchUserOrders(userId: string): Promise<StorefrontOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(mapOrderRow);
}

export async function fetchUserOrder(
  userId: string,
  orderId: string
): Promise<StorefrontOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapOrderRow(data as OrderRow);
}

async function applyOrderStatus(
  orderId: string,
  status: string,
  options?: {
    deliveredAt?: string | null;
    markReceived?: boolean;
    paymentStatus?: string | null;
    actionCompleted?: boolean | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_delivered_at: options?.deliveredAt ?? null,
    p_mark_received: options?.markReceived ?? false,
    p_payment_status: options?.paymentStatus ?? null,
    p_action_completed: options?.actionCompleted ?? null,
  });
  if (error) throw error;
}

export async function markOrderReceived(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ order_received: true })
    .eq("id", orderId);
  if (error) throw error;
}

export async function confirmOrderReceived(orderId: string): Promise<void> {
  await applyOrderStatus(orderId, "delivered", {
    deliveredAt: new Date().toISOString(),
    markReceived: true,
    paymentStatus: "paid",
  });
}

export async function updateUserOrderStatus(
  orderId: string,
  status: string
): Promise<void> {
  await applyOrderStatus(orderId, status);
}

export function canCustomerCancelOrder(status: string): boolean {
  return status === "pending";
}

export async function cancelUserOrder(orderId: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (fetchError) throw fetchError;
  if (!canCustomerCancelOrder(data.status)) {
    throw new Error("Only pending orders can be cancelled");
  }

  await applyOrderStatus(orderId, "cancelled");
}

export async function completeUserOrder(orderId: string): Promise<void> {
  await applyOrderStatus(orderId, "completed", { actionCompleted: true });
}

export async function returnUserOrder(
  orderId: string,
  items: StorefrontOrderItem[],
  reason: string,
  userId: string
): Promise<void> {
  await applyOrderStatus(orderId, "returned/refunded", {
    actionCompleted: true,
  });

  const rows = items
    .filter((item) => item.productId)
    .map((item) => ({
      product_id: item.productId!,
      order_id: orderId,
      user_id: userId,
      price: item.price,
      reason,
      product_name: item.name,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("returns").insert(rows);
    if (error) throw error;
  }
}

export async function rateOrderItems(
  orderId: string,
  items: StorefrontOrderItem[],
  rating: number,
  feedback: string,
  userId: string,
  userEmail?: string | null,
  orderNumber?: string
): Promise<void> {
  const reviews = items
    .filter((item) => item.productId)
    .map((item) => ({
      product_id: item.productId!,
      user_id: userId,
      user_email: userEmail ?? null,
      rating,
      feedback,
      product_name: item.name,
      order_id: orderId,
    }));

  if (reviews.length > 0) {
    const { error } = await supabase.from("product_reviews").insert(reviews);
    if (error) throw error;
  }

  await applyOrderStatus(orderId, "completed", { actionCompleted: true });

  void orderNumber;
}
