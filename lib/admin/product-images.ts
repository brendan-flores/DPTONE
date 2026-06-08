import { productImageUrl } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const BRAND_FOLDER_MAP: Record<string, string> = {
  "Charlotte Folk": "CHARLOTTE FOLK PRODUCTS",
  "MN+LA": "MNLA PRODUCTS",
  Richboyz: "RICHBOYZ PRODUCTS",
  Strap: "STRAP PRODUCTS",
};

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;

type ListedItem = { name: string; id: string | null };

async function listImagesUnderPrefix(
  prefix: string,
  depth = 0
): Promise<string[]> {
  if (depth > 3) return [];

  const clean = prefix.replace(/^\/+|\/+$/g, "");
  const { data, error } = await supabaseAdmin.storage
    .from("product-images")
    .list(clean, { limit: 200, sortBy: { column: "name", order: "asc" } });

  if (error || !data?.length) return [];

  const urls: string[] = [];

  for (const item of data as ListedItem[]) {
    if (item.name.startsWith(".")) continue;
    const isFolder = item.id === null;
    if (isFolder) {
      const nested = await listImagesUnderPrefix(`${clean}/${item.name}`, depth + 1);
      urls.push(...nested);
    } else if (IMAGE_EXT.test(item.name)) {
      urls.push(productImageUrl(`${clean}/${item.name}`));
    }
  }

  return urls;
}

/** List selectable product images for a brand (searches common storage folder layouts). */
export async function listBrandProductImages(brand: string): Promise<string[]> {
  const mapped = BRAND_FOLDER_MAP[brand] ?? brand;
  const prefixes = [
    mapped,
    `product-images/${mapped}`,
    `DEPLOYED IMAGES/${mapped}`,
    `product-images/DEPLOYED IMAGES/${mapped}`,
    `DEPLOYED IMAGES/${brand}`,
    brand,
    `product-images/${brand}`,
  ];

  const seen = new Set<string>();
  for (const prefix of prefixes) {
    const urls = await listImagesUnderPrefix(prefix);
    for (const url of urls) seen.add(url);
  }

  return Array.from(seen);
}

export async function uploadCroppedProductImage(
  brand: string,
  blob: Blob,
  fileName: string
): Promise<string> {
  const folder = BRAND_FOLDER_MAP[brand] ?? brand;
  const filePath = `product-images/DEPLOYED IMAGES/${folder}/${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from("product-images")
    .upload(filePath, blob, { contentType: "image/jpeg", upsert: false });

  if (error) throw error;
  return productImageUrl(filePath);
}
