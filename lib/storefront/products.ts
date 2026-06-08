import { supabase } from "@/lib/supabase";

export type StorefrontProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  color?: string;
  brand?: string;
  isFeaturedProduct: boolean;
  totalStock: number;
  purchasedCount?: number;
  imageUrls: string[];
  sizes: { size: string; stock: number }[];
  stock?: number;
  imageUrl?: string;
  created_at?: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  color: string | null;
  brand: string | null;
  is_featured: boolean;
  total_stock: number;
  purchased_count: number;
  created_at?: string;
};

type ProductWithRelations = ProductRow & {
  product_sizes?: { size: string; stock: number }[];
  product_images?: { url: string }[];
};

const PRODUCT_SELECT = `
  id, name, description, price, color, brand, is_featured, total_stock, purchased_count, created_at,
  product_sizes (size, stock),
  product_images (url)
`;

function mapProduct(row: ProductWithRelations): StorefrontProduct {
  const imageUrls = (row.product_images ?? []).map((i) => i.url);
  const sizes = (row.product_sizes ?? []).map((s) => ({
    size: s.size,
    stock: s.stock,
  }));

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    price: Number(row.price),
    color: row.color ?? undefined,
    brand: row.brand ?? undefined,
    isFeaturedProduct: row.is_featured,
    totalStock: row.total_stock,
    purchasedCount: row.purchased_count,
    imageUrls,
    imageUrl: imageUrls[0],
    sizes,
    stock: row.total_stock,
    created_at: row.created_at,
  };
}

export async function fetchStorefrontProducts(): Promise<StorefrontProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  return (data as ProductWithRelations[]).map(mapProduct);
}

export async function fetchStorefrontProductById(
  id: string
): Promise<StorefrontProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapProduct(data as ProductWithRelations);
}

export async function fetchProductReviews(productId: string) {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, user_email, rating, feedback, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.user_email,
    rating: r.rating,
    feedback: r.feedback,
    timestamp: r.created_at,
  }));
}

export async function fetchProductRatingSummary(productId: string) {
  const { data, error } = await supabase
    .from("product_ratings_summary")
    .select("average_rating, review_count")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { averageRating: 0, reviewCount: 0 };

  return {
    averageRating: Number(data.average_rating),
    reviewCount: data.review_count,
  };
}

let storefrontChannelCounter = 0;

export function subscribeStorefrontProducts(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const debounced = () => {
    if (cancelled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!cancelled) onChange();
    }, 250);
  };

  // Unique channel per subscriber — Header and homepage both use this hook.
  const channel = supabase.channel(
    `storefront-products:${++storefrontChannelCounter}`
  );

  for (const table of ["products", "product_sizes", "product_images"]) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      debounced
    );
  }

  channel.subscribe();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
