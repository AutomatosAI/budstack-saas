'use client';

import {
  LayoutDashboard,
  Building2,
  UserPlus,
  BarChart3,
  Palette,
  Layout,
  Settings,
} from 'lucide-react';
import { AdminSidebar, type AdminMenuItem } from './AdminSidebar';

/**
 * Panel types for super admin navigation
 */
export enum PanelType {
  OVERVIEW = 'overview',
  TENANTS = 'tenants',
  ONBOARDING = 'onboarding',
  ANALYTICS = 'analytics',
  BRANDING = 'branding',
  TEMPLATES = 'templates',
  SETTINGS = 'settings',
}

/**
 * Menu items for the super admin sidebar
 */
const superAdminMenuItems: AdminMenuItem[] = [
  { id: PanelType.OVERVIEW, label: 'Overview', icon: LayoutDashboard, href: '/super-admin', shortcut: ['G', 'D'] },
  { id: PanelType.TENANTS, label: 'Tenants', icon: Building2, href: '/super-admin/tenants', shortcut: ['G', 'T'] },
  { id: PanelType.ONBOARDING, label: 'Onboarding', icon: UserPlus, href: '/super-admin/onboarding' },
  { id: PanelType.ANALYTICS, label: 'Analytics', icon: BarChart3, href: '/super-admin/analytics' },
  { id: PanelType.BRANDING, label: 'Branding', icon: Palette, href: '/super-admin/platform-settings' },
  { id: PanelType.TEMPLATES, label: 'Templates', icon: Layout, href: '/super-admin/templates' },
  { id: PanelType.SETTINGS, label: 'Settings', icon: Settings, href: '/super-admin/settings' },
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
export function SuperAdminSidebar({ userName, userEmail }: SuperAdminSidebarProps) {
  return (
    <AdminSidebar
      theme="super-admin"
      menuItems={superAdminMenuItems}
      userName={userName}
      userEmail={userEmail}
      headerBadge="SUPER ADMIN"
    />
  );
}
