import { supabaseAdmin } from "@/lib/supabase-admin";

export type AdminProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  color?: string;
  brand?: string;
  isFeaturedProduct?: boolean;
  totalStock?: number;
  purchasedCount?: number;
  imageUrls?: string[];
  sizes?: { size: string; stock: number }[];
  stock?: number;
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
};

function mapProduct(
  row: ProductRow,
  sizes: { product_id: string; size: string; stock: number }[],
  images: { product_id: string; url: string }[]
): AdminProduct {
  const productSizes = sizes
    .filter((s) => s.product_id === row.id)
    .map((s) => ({ size: s.size, stock: s.stock }));
  const imageUrls = images
    .filter((i) => i.product_id === row.id)
    .map((i) => i.url);

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
    sizes: productSizes,
    stock: row.total_stock,
  };
}

type ProductWithRelations = ProductRow & {
  product_sizes?: { size: string; stock: number }[];
  product_images?: { url: string }[];
};

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select(
      `
      id, name, description, price, color, brand, is_featured, total_stock, purchased_count,
      product_sizes (size, stock),
      product_images (url)
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!products?.length) return [];

  return (products as ProductWithRelations[]).map((p) => {
    const sizes = (p.product_sizes ?? []).map((s) => ({
      product_id: p.id,
      size: s.size,
      stock: s.stock,
    }));
    const images = (p.product_images ?? []).map((i) => ({
      product_id: p.id,
      url: i.url,
    }));
    return mapProduct(p, sizes, images);
  });
}

export async function createAdminProduct(input: {
  name: string;
  description?: string;
  price: number;
  color?: string;
  brand?: string;
  isFeaturedProduct?: boolean;
  imageUrls: string[];
  sizes: { size: string; stock: number }[];
}) {
  const totalStock = input.sizes.reduce((sum, s) => sum + s.stock, 0);

  const { data: product, error } = await supabaseAdmin
    .from("products")
    .insert({
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      color: input.color ?? null,
      brand: input.brand ?? null,
      is_featured: input.isFeaturedProduct ?? false,
      total_stock: totalStock,
      purchased_count: 0,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.sizes.length) {
    const { error: sizesError } = await supabaseAdmin.from("product_sizes").insert(
      input.sizes.map((s) => ({
        product_id: product.id,
        size: s.size,
        stock: s.stock,
      }))
    );
    if (sizesError) throw sizesError;
  }

  if (input.imageUrls.length) {
    const { error: imagesError } = await supabaseAdmin.from("product_images").insert(
      input.imageUrls.map((url) => ({
        product_id: product.id,
        url,
      }))
    );
    if (imagesError) throw imagesError;
  }

  return product.id as string;
}

export async function updateAdminProduct(
  id: string,
  input: {
    name?: string;
    price?: number;
    sizes?: { size: string; stock: number }[];
    isFeaturedProduct?: boolean;
  }
) {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.price !== undefined) update.price = input.price;
  if (input.isFeaturedProduct !== undefined)
    update.is_featured = input.isFeaturedProduct;

  if (input.sizes) {
    update.total_stock = input.sizes.reduce((sum, s) => sum + s.stock, 0);
    await supabaseAdmin.from("product_sizes").delete().eq("product_id", id);
    if (input.sizes.length) {
      await supabaseAdmin.from("product_sizes").insert(
        input.sizes.map((s) => ({
          product_id: id,
          size: s.size,
          stock: s.stock,
        }))
      );
    }
  }

  if (Object.keys(update).length) {
    const { error } = await supabaseAdmin.from("products").update(update).eq("id", id);
    if (error) throw error;
  }
}

export async function deleteAdminProduct(id: string) {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function countAdminProducts(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("products")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
