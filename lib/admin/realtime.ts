import { supabaseAdmin } from "@/lib/supabase-admin";

export const ADMIN_REALTIME_TABLES = {
  products: ["products", "product_sizes", "product_images"],
  orders: ["orders", "order_items"],
  sales: ["sales"],
  activities: ["activities", "users"],
  analytics: ["users", "products", "orders", "sales", "activities"],
  analyticsFeedback: ["product_reviews", "returns", "product_ratings_summary"],
} as const;

export type AdminRealtimeTable =
  (typeof ADMIN_REALTIME_TABLES)[keyof typeof ADMIN_REALTIME_TABLES][number];

const DEBOUNCE_MS = 250;

/** Subscribe to postgres changes; debounced callback for fast coalesced refetches. */
export function subscribeAdminTables(
  tables: readonly AdminRealtimeTable[],
  onChange: () => void,
  channelName: string
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const debounced = () => {
    if (cancelled) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!cancelled) onChange();
    }, DEBOUNCE_MS);
  };

  const channel = supabaseAdmin.channel(`admin:${channelName}`);

  for (const table of tables) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      debounced
    );
  }

  channel.subscribe();

  return () => {
    cancelled = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabaseAdmin.removeChannel(channel);
  };
}
