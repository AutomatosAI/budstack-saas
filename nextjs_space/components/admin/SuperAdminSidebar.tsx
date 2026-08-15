"use client";

import {
  LayoutDashboard,
  Building2,
  UserPlus,
  UserCog,
  BarChart3,
  Palette,
  Layout,
  Settings,
  Mail,
  GraduationCap,
  Database,
  FileText,
  Newspaper,
} from "lucide-react";
import { AdminSidebar, type AdminMenuItem } from "./AdminSidebar";

/**
 * Panel types for super admin navigation
 */
export enum PanelType {
  OVERVIEW = "overview",
  TENANTS = "tenants",
  LEADS = "leads",
  THE_WIRE = "the-wire",
  IMPERSONATION = "impersonation",
  ONBOARDING = "onboarding",
  ANALYTICS = "analytics",
  BRANDING = "branding",
  TEMPLATES = "templates",
  LEARNING = "learning",
  EMAILS = "emails",
  SETTINGS = "settings",
  SUBPROCESSORS = "subprocessors",
  LEGAL_TEMPLATES = "legal-templates",
}

/**
 * Menu items for the super admin sidebar
 */
const superAdminMenuItems: AdminMenuItem[] = [
  {
    id: PanelType.OVERVIEW,
    label: "Overview",
    icon: LayoutDashboard,
    href: "/super-admin",
    shortcut: ["G", "D"],
  },
  {
    id: PanelType.TENANTS,
    label: "Tenants",
    icon: Building2,
    href: "/super-admin/tenants",
    shortcut: ["G", "T"],
  },
  {
    id: PanelType.LEADS,
    label: "Leads",
    icon: UserPlus,
    href: "/super-admin/leads",
  },
  {
    // The budstacks.io blog. Sits next to Leads because both are the platform's
    // own content, not anything a tenant owns.
    id: PanelType.THE_WIRE,
    label: "The Wire",
    icon: Newspaper,
    href: "/super-admin/the-wire",
  },
  {
    id: PanelType.IMPERSONATION,
    label: "Impersonation",
    icon: UserCog,
    href: "/super-admin/impersonation",
    shortcut: ["G", "I"],
  },
  {
    id: PanelType.ONBOARDING,
    label: "Onboarding",
    icon: UserPlus,
    href: "/super-admin/onboarding",
  },
  {
    id: PanelType.ANALYTICS,
    label: "Analytics",
    icon: BarChart3,
    href: "/super-admin/analytics",
  },
  {
    id: PanelType.BRANDING,
    label: "Branding",
    icon: Palette,
    href: "/super-admin/platform-settings",
  },
  {
    id: PanelType.TEMPLATES,
    label: "Store Themes",
    icon: Layout,
    href: "/super-admin/templates",
  },
  {
    id: PanelType.LEARNING,
    label: "Learning Center",
    icon: GraduationCap,
    href: "/super-admin/learning",
  },
  {
    id: PanelType.EMAILS,
    label: "Email Templates",
    icon: Mail,
    href: "/super-admin/emails",
  },
  {
    id: PanelType.LEGAL_TEMPLATES,
    label: "Legal Wording",
    icon: FileText,
    href: "/super-admin/legal-templates",
  },
  {
    id: PanelType.SUBPROCESSORS,
    label: "Sub-processors",
    icon: Database,
    href: "/super-admin/subprocessors",
  },
  {
    id: PanelType.SETTINGS,
    label: "Settings",
    icon: Settings,
    href: "/super-admin/settings",
  },
];

interface SuperAdminSidebarProps {
  userName: string;
  userEmail: string;
}

/**
 * Super Admin sidebar component with mobile responsive behavior.
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
export function SuperAdminSidebar({
  userName,
  userEmail,
}: SuperAdminSidebarProps) {
  return (
    <AdminSidebar
      theme="super-admin"
      accent="gold"
      menuItems={superAdminMenuItems}
      userName={userName}
      userEmail={userEmail}
      headerBadge="SUPER ADMIN"
    />
  );
}
