import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

/** Storefront / customer Supabase client — separate session from admin. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "dptone-customer-auth",
    detectSessionInUrl: true,
    flowType: "pkce",
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/** Public storage URL for the product-images bucket */
export function productImageUrl(path: string): string {
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/product-images/${encoded}`;
}
