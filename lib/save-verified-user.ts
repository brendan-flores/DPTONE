import { supabase } from "@/lib/supabase";

type VerifiedUserInput = {
  id: string;
  email: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
};

/**
 * Save a verified customer to public.users.
 * Returns false for admin accounts (they belong in admin_users only).
 */
export async function saveVerifiedUser(
  input: VerifiedUserInput
): Promise<boolean> {
  const { data: isAdmin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", input.id)
    .maybeSingle();

  if (adminError) {
    console.error("Failed to check admin status:", adminError.message);
  }
  if (isAdmin?.user_id) {
    return false;
  }

  const { data: saved, error } = await supabase.rpc("save_verified_customer", {
    p_email: input.email ?? "",
    p_display_name: input.displayName ?? null,
    p_phone_number: input.phoneNumber ?? null,
  });

  if (error) {
    console.error("Failed to save verified user:", error.message);
    throw error;
  }

  return saved === true;
}
