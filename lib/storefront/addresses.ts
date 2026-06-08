import { supabase } from "@/lib/supabase";

export type UserAddress = {
  id: string;
  isDefault: boolean;
  country: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  region: string;
  phone: string;
};

export async function fetchUserAddresses(
  userId: string
): Promise<UserAddress[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    isDefault: row.is_default,
    country: row.country,
    firstName: row.first_name,
    lastName: row.last_name,
    address1: row.address1,
    address2: row.address2 ?? undefined,
    postalCode: row.postal_code,
    city: row.city,
    region: row.region,
    phone: row.phone,
  }));
}
