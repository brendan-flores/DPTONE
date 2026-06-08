import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "DPT ONE admin",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
