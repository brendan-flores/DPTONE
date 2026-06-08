"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AdminUser = {
  uid: string;
  email: string | null;
};

type AdminAuthContextType = {
  adminUser: AdminUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  isAdmin: false,
  loading: true,
  signIn: async () => false,
  signOut: async () => {},
});

async function verifyAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return !error && !!data;
}

function mapAdminUser(u: { id: string; email?: string | null } | null): AdminUser | null {
  if (!u) return null;
  return { uid: u.id, email: u.email ?? null };
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolveSession = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setAdminUser(null);
      setIsAdmin(false);
      return;
    }
    const ok = await verifyAdminUser(userId);
    if (!ok) {
      await supabaseAdmin.auth.signOut();
      setAdminUser(null);
      setIsAdmin(false);
      return;
    }
    const { data } = await supabaseAdmin.auth.getUser();
    setAdminUser(mapAdminUser(data.user));
    setIsAdmin(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabaseAdmin.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      if (!user) {
        setAdminUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      await resolveSession(user.id);
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseAdmin.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setAdminUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      await resolveSession(session.user.id);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const userId = data.user?.id;
    if (!userId) return false;

    const ok = await verifyAdminUser(userId);
    if (!ok) {
      await supabaseAdmin.auth.signOut();
      setAdminUser(null);
      setIsAdmin(false);
      return false;
    }

    setAdminUser(mapAdminUser(data.user));
    setIsAdmin(true);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabaseAdmin.auth.signOut();
    setAdminUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ adminUser, isAdmin, loading, signIn, signOut }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
