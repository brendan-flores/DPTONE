"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import AdminSidebar from "@/components/AdminSidebar";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { AdminAnalyticsProvider } from "@/context/AdminAnalyticsContext";
import { getActiveAdminSection } from "@/lib/admin/sections";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading, signIn, signOut } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeSection = getActiveAdminSection(pathname ?? "/admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldLock = isAdmin || sidebarOpen;
    if (shouldLock) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [sidebarOpen, isAdmin]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const success = await signIn(email, password);
      if (!success) {
        toast({
          title: "Unauthorized",
          description: "You are not authorized to access the admin panel.",
        });
      }
      return success;
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (
        ![
          "invalid_credentials",
          "auth/invalid-credential",
          "auth/wrong-password",
          "auth/user-not-found",
          "auth/too-many-requests",
        ].includes(code)
      ) {
        toast({
          title: "Login failed",
          description:
            error instanceof Error
              ? error.message
              : "An error occurred during login.",
        });
      }
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace("/admin/add-product");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#161e2e] text-[#8ec0ff] overflow-hidden">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminLoginForm onLogin={handleLogin} />;
  }

  return (
    <AdminAnalyticsProvider enabled={isAdmin}>
      <div className="h-screen w-full bg-[#161e2e] flex overflow-hidden">
        <div className="hidden sm:flex shrink-0 h-full">
          <AdminSidebar
            activeSection={activeSection}
            onLogout={handleLogout}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="shrink-0 sm:hidden px-4 pt-4">
            <button
              className="text-[#8ec0ff]"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Menu className="h-7 w-7" />
            </button>
          </div>

          {sidebarOpen && (
            <div className="fixed inset-0 z-50 flex sm:hidden">
              <AdminSidebar
                activeSection={activeSection}
                onLogout={handleLogout}
                sidebarOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(false)}
              />
              <div
                className="flex-1 bg-black bg-opacity-40"
                onClick={() => setSidebarOpen(false)}
              />
            </div>
          )}

          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </AdminAnalyticsProvider>
  );
}
