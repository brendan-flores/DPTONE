"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  emailVerified: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

function mapSupabaseUserToAppUser(
  u: {
    id: string;
    email: string | null;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null
): AppUser | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  return {
    uid: u.id,
    email: u.email,
    displayName: typeof meta.displayName === "string" ? meta.displayName : null,
    phoneNumber: typeof meta.phoneNumber === "string" ? meta.phoneNumber : null,
    emailVerified: Boolean(u.email_confirmed_at),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(mapSupabaseUserToAppUser(data.session?.user ?? null));
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUserToAppUser(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) return;
    setUser(mapSupabaseUserToAppUser(data.user));
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);