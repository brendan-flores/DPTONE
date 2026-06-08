import { supabase } from "@/lib/supabase";

/** Refetch orders when the customer's rows change (e.g. admin status update). */
export function subscribeUserOrders(
  userId: string,
  onChange: () => void
): () => void {
  const channel = supabase
    .channel(`storefront-orders:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `user_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
