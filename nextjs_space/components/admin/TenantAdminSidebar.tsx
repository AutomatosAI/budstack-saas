"use client";

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
  Cookie,
  Mail,
  Search,
  UsersRound,
} from "lucide-react";
import { AdminSidebar, type AdminMenuItem } from "./AdminSidebar";
import { NAV_ITEM_PERMISSIONS } from "@/lib/permissions/nav-permissions";
import type { PermissionSet } from "@/lib/permissions/permission-keys";

/**
 * Menu items for the tenant admin sidebar
 */
const tenantAdminMenuItems: AdminMenuItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/tenant-admin",
    shortcut: ["G", "D"],
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    href: "/tenant-admin/products",
    shortcut: ["G", "P"],
  },
  {
    id: "orders",
    label: "Orders",
    icon: ShoppingBag,
    href: "/tenant-admin/orders",
    shortcut: ["G", "O"],
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
  { id: "seo", label: "SEO Manager", icon: Search, href: "/tenant-admin/seo" },
  {
    id: "templates",
    label: "Store Themes",
    icon: Layout,
    href: "/tenant-admin/templates",
  },
  {
    id: "emails",
    label: "Email Templates",
    icon: Mail,
    href: "/tenant-admin/emails",
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
    id: "team",
    label: "Team",
    icon: UsersRound,
    href: "/tenant-admin/team",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/tenant-admin/settings",
  },
  {
    id: "cookie-settings",
    label: "Cookie Settings",
    icon: Cookie,
    href: "/tenant-admin/cookie-settings",
  },
];

interface TenantAdminSidebarProps {
  userName: string;
  userEmail: string;
  tenantName: string;
  /** Resolved permissions; when provided, nav items are filtered by NAV_ITEM_PERMISSIONS. */
  permissions?: PermissionSet;
}

/**
 * Tenant Admin sidebar component with mobile responsive behavior.
 *
 * Features:
 * - Hidden off-canvas on mobile (<768px) by default
 * - Hamburger menu button in top-left corner (visible on mobile only)
 * - Sidebar slides in from left when hamburger clicked
 * - Dark overlay covers content when sidebar open (click to close)
 * - Closes automatically when route changes on mobile
 * - Desktop behavior unchanged (sidebar always visible)
 * - Smooth transitions (300ms) for open/close animations
 */
export function TenantAdminSidebar({
  userName,
  userEmail,
  tenantName,
  permissions,
}: TenantAdminSidebarProps) {
  const menuItems = permissions
    ? tenantAdminMenuItems.filter((item) => {
        const required = NAV_ITEM_PERMISSIONS[item.id];
        return !required || permissions[required] === true;
      })
    : tenantAdminMenuItems;

  return (
    <AdminSidebar
      theme="tenant-admin"
      accent="green"
      menuItems={menuItems}
      userName={userName}
      userEmail={userEmail}
      headerBadge={tenantName}
    />
  );
}
