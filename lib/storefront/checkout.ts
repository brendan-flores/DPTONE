import { supabase } from "@/lib/supabase";

export type CheckoutOrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  color?: string;
};

export type CheckoutAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  region: string;
  phone: string;
  country?: string;
  email?: string;
};

export type CompleteOrderInput = {
  orderNumber: string;
  status?: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax?: number;
  paymentMethod: string;
  paymentStatus?: string;
  shippingAddress: CheckoutAddress;
  billingAddress: CheckoutAddress;
  items: CheckoutOrderItem[];
  userEmail?: string;
  notes?: string;
};

/** Create order, line items, sales, activity, and decrement inventory (Supabase RPC). */
export async function completeCustomerOrder(
  input: CompleteOrderInput
): Promise<string> {
  const orderPayload = {
    orderNumber: input.orderNumber,
    status: input.status ?? "pending",
    total: input.total,
    subtotal: input.subtotal,
    shipping: input.shipping,
    tax: input.tax ?? 0,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus ?? "pending",
    dateOrderedClient: new Date().toISOString(),
    shippingAddress: input.shippingAddress,
    billingAddress: input.billingAddress,
    userEmail: input.userEmail,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase.rpc("complete_customer_order", {
    p_order: orderPayload,
    p_items: input.items,
  });

  if (error) throw error;
  if (!data) throw new Error("Order was not created.");

  return data as string;
}

export async function saveOrderReceipt(
  userId: string,
  orderId: string,
  orderNumber: string,
  receiptData: Record<string, unknown>
) {
  const { error } = await supabase.from("order_receipts").insert({
    user_id: userId,
    order_id: orderId,
    order_number: orderNumber,
    receipt_data: receiptData,
  });
  if (error) throw error;
}
