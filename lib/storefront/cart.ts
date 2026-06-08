import { supabase } from "@/lib/supabase";

export interface CartItem {
  id: string;
  name: string;
  image: string;
  price: string;
  quantity: number;
  selectedSize?: string;
  color?: string;
  selectedColor?: string;
}

type CartRow = {
  product_id: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  selected_size: string | null;
  selected_color: string | null;
};

function parsePrice(price: string | number): number {
  if (typeof price === "number") return price;
  return parseFloat(price.replace(/[^\d.]/g, "")) || 0;
}

function rowToCartItem(row: CartRow): CartItem {
  return {
    id: row.product_id,
    name: row.name,
    image: row.image ?? "",
    price: String(row.price),
    quantity: row.quantity,
    selectedSize: row.selected_size ?? undefined,
    selectedColor: row.selected_color ?? undefined,
    color: row.selected_color ?? undefined,
  };
}

function itemSelection(item: Pick<CartItem, "selectedSize" | "selectedColor" | "color">) {
  return {
    selected_size: item.selectedSize ?? null,
    selected_color: item.selectedColor ?? item.color ?? null,
  };
}

export async function fetchUserCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, name, image, price, quantity, selected_size, selected_color")
    .eq("user_id", userId);

  if (error) throw error;
  return ((data ?? []) as CartRow[]).map(rowToCartItem);
}

export async function upsertCartItem(
  userId: string,
  item: CartItem,
  quantity: number
): Promise<void> {
  const selection = itemSelection(item);
  const { error } = await supabase.from("cart_items").upsert(
    {
      user_id: userId,
      product_id: item.id,
      name: item.name,
      image: item.image || null,
      price: parsePrice(item.price),
      quantity,
      ...selection,
    },
    { onConflict: "user_id,product_id,selected_size,selected_color" }
  );
  if (error) throw error;
}

export async function deleteCartItem(
  userId: string,
  item: Pick<CartItem, "id" | "selectedSize" | "selectedColor" | "color">
): Promise<void> {
  const selection = itemSelection(item);
  let query = supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", item.id);

  if (selection.selected_size) {
    query = query.eq("selected_size", selection.selected_size);
  } else {
    query = query.is("selected_size", null);
  }

  if (selection.selected_color) {
    query = query.eq("selected_color", selection.selected_color);
  } else {
    query = query.is("selected_color", null);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function clearUserCart(userId: string): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export function subscribeUserCart(
  userId: string,
  onChange: () => void
): () => void {
  const channel = supabase
    .channel(`storefront-cart:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cart_items",
        filter: `user_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
