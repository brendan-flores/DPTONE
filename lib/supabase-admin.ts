import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

/** Admin-only Supabase client — separate session from the storefront (different storageKey). */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "dptone-admin-auth",
    detectSessionInUrl: false,
    flowType: "pkce",
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
