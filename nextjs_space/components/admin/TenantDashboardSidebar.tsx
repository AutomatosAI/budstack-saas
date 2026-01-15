"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Palette,
  Layout,
  Settings,
  Shield,
  Webhook,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";

interface TenantDashboardSidebarProps {
  userName: string;
  userEmail: string;
  tenantName: string;
}

const menuItems = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/tenant-admin",
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    href: "/tenant-admin/products",
  },
  {
    id: "orders",
    label: "Orders",
    icon: ShoppingBag,
    href: "/tenant-admin/orders",
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    href: "/tenant-admin/customers",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/tenant-admin/analytics",
  },
  {
    id: "branding",
    label: "Branding",
    icon: Palette,
    href: "/tenant-admin/branding",
  },
  {
    id: "templates",
    label: "Templates",
    icon: Layout,
    href: "/tenant-admin/templates",
  },
  {
    id: "the-wire",
    label: "The Wire",
    icon: Newspaper,
    href: "/tenant-admin/the-wire",
  },
  {
    id: "webhooks",
    label: "Webhooks",
    icon: Webhook,
    href: "/tenant-admin/webhooks",
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    icon: Shield,
    href: "/tenant-admin/audit-logs",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/tenant-admin/settings",
  },
];

export function TenantDashboardSidebar({
  userName,
  userEmail,
  tenantName,
}: TenantDashboardSidebarProps) {
  const { signOut } = useClerk();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      await signOut({ redirectUrl: "/sign-in" });
    }
  };

  const isActive = (href: string) => {
    if (href === "/tenant-admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div
      className={`${collapsed ? "w-20" : "w-64"
        } bg-gradient-to-b from-cyan-600 via-blue-600 to-indigo-700 text-white flex flex-col transition-all duration-300 ease-in-out relative`}
    >
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-indigo-600 font-bold text-lg">B</span>
            </div>
            <h1 className="text-xl font-bold">BudStack</h1>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-6 pb-4">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
            {tenantName}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all group relative ${active
                ? "bg-cyan-500/30 text-white border-l-4 border-cyan-300"
                : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              title={collapsed ? item.label : ""}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-cyan-100" : "text-white/70"} group-hover:text-white transition-colors`}
              />
              {!collapsed && (
                <span
                  className={`font-medium ${active ? "text-white" : "text-white/90"}`}
                >
                  {item.label}
                </span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-semibold shadow-lg">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {userName}
                </p>
                <p className="text-xs text-white/70 truncate">{userEmail}</p>
              </div>
            </div>
            <Link
              href="/tenant-admin/profile"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium mb-2"
            >
              Your Profile
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full p-2 hover:bg-white/10 rounded-lg transition-colors group relative"
            title="Logout"
          >
            <LogOut className="h-5 w-5 mx-auto" />
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Logout
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
