import Link from "next/link";
import { Plus, ShoppingCart, List, Activity, BarChart2, Home, LogOut, X } from "lucide-react";
import React from "react";
import { LOGO_URL } from "@/lib/assets";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";

const iconMap: Record<string, React.ReactNode> = {
  "add-product": <Plus className="w-4 h-4 mr-2" />,
  products: <List className="w-4 h-4 mr-2" />,
  orders: <ShoppingCart className="w-4 h-4 mr-2" />,
  activities: <Activity className="w-4 h-4 mr-2" />,
  analytics: <BarChart2 className="w-4 h-4 mr-2" />,
};

export default function AdminSidebar({
  activeSection,
  onLogout,
  sidebarOpen,
  toggleSidebar,
}: {
  activeSection: string;
  onLogout: () => void;
  sidebarOpen?: boolean;
  toggleSidebar?: () => void;
}) {
  const isMobile = typeof sidebarOpen === "boolean";

  return (
    <aside
      className={[
        "bg-[#101726] text-[#8ec0ff] w-60 h-full flex flex-col shrink-0 z-40",
        isMobile
          ? "fixed top-0 left-0 h-screen transition-transform duration-300 " +
            (sidebarOpen ? "translate-x-0" : "-translate-x-full")
          : "",
      ].join(" ")}
    >
      {isMobile && toggleSidebar && (
        <button
          className="absolute top-4 right-4 text-[#8ec0ff] p-2"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        >
          <X className="h-6 w-6" />
        </button>
      )}

      <div className="shrink-0 flex items-center px-5 pt-6 pb-4">
        <img
          src={LOGO_URL}
          alt="DPT ONE Logo"
          width={56}
          height={56}
          className="w-14 h-14 object-contain mr-3"
        />
        <span className="text-lg font-bold text-[#8ec0ff] tracking-wide">
          DPT ONE
        </span>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 flex flex-col gap-2">
        {ADMIN_SECTIONS.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            onClick={toggleSidebar}
            className={`flex items-center px-4 py-2 rounded-md transition-colors font-medium text-base w-full text-left ${
              activeSection === item.slug
                ? "bg-[#1e293b] text-[#3390ff]"
                : "hover:bg-[#1e293b] text-[#8ec0ff]"
            }`}
          >
            {iconMap[item.slug]}
            {item.label}
          </Link>
        ))}
        <Link
          href="/"
          onClick={toggleSidebar}
          className="flex items-center px-4 py-2 rounded-md transition-colors font-medium text-base w-full text-left hover:bg-[#1e293b] text-[#8ec0ff] no-underline"
        >
          <Home className="w-4 h-4 mr-2" />
          Return to Homepage
        </Link>
      </nav>

      <div className="shrink-0 border-t border-[#22304a] bg-[#101726] px-3">
        <button
          onClick={onLogout}
          className="flex items-center px-4 py-4 w-full text-left hover:bg-[#1e293b] text-[#8ec0ff] hover:text-[#3390ff] rounded-md"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </button>
      </div>
    </aside>
  );
}
