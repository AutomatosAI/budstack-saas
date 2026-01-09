'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

/**
 * Menu item configuration for the sidebar navigation
 */
export interface AdminMenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Display label for the menu item */
  label: string;
  /** Lucide icon component to render */
  icon: LucideIcon;
  /** Navigation href for the link */
  href: string;
}

/**
 * Theme configuration for visual differentiation between admin types
 */
export type AdminTheme = 'super-admin' | 'tenant-admin';

/**
 * Props for the AdminSidebar component
 */
export interface AdminSidebarProps {
  /** Visual theme determining color scheme and styling */
  theme: AdminTheme;
  /** Array of navigation menu items */
  menuItems: AdminMenuItem[];
  /** Display name of the logged-in user */
  userName: string;
  /** Email address of the logged-in user */
  userEmail: string;
  /** Badge text displayed below the logo (e.g., "SUPER ADMIN" or tenant name) */
  headerBadge?: string;
}

/**
 * Theme-specific style configurations
 * Super Admin: Dark slate/zinc palette for authoritative, platform-level feel
 * Tenant Admin: Vibrant cyan/blue palette for energetic store management
 */
const themeStyles = {
  'super-admin': {
    // Dark, authoritative gradient - slate to zinc for depth
    gradient: 'from-slate-800 via-slate-900 to-zinc-900',
    // Subtle slate active states with left border accent
    activeItem: 'bg-slate-700/50 border-l-4 border-slate-400',
    activeIcon: 'text-slate-200',
    hoverBg: 'hover:bg-slate-700/30',
    // Muted, professional avatar gradient
    avatarGradient: 'from-slate-400 to-slate-600',
    // Bold badge styling for SUPER ADMIN distinction
    badgeBg: 'bg-slate-700/60 border border-slate-500/50',
    badgeText: 'text-slate-200 font-bold tracking-wide uppercase text-xs',
    // Slate-toned logo
    logoAccent: 'text-slate-800',
    logoBg: 'bg-slate-400',
    // Border and divider colors
    borderColor: 'border-slate-700/50',
    // Button styling
    buttonBg: 'bg-slate-700/50 hover:bg-slate-600/50',
  },
  'tenant-admin': {
    // Vibrant, energetic gradient - cyan/blue palette for store management
    gradient: 'from-cyan-600 via-blue-600 to-indigo-700',
    // Cyan accent for active states
    activeItem: 'bg-cyan-500/30 border-l-4 border-cyan-300',
    activeIcon: 'text-cyan-100',
    hoverBg: 'hover:bg-white/10',
    // Cyan-to-blue avatar gradient
    avatarGradient: 'from-cyan-400 to-blue-500',
    // Tenant business name badge styling
    badgeBg: 'bg-white/20',
    badgeText: 'text-white/90 font-medium',
    // Cyan-toned logo
    logoAccent: 'text-cyan-700',
    logoBg: 'bg-cyan-100',
    borderColor: 'border-white/10',
    buttonBg: 'bg-white/10 hover:bg-white/20',
  },
} as const;

/**
 * Unified admin sidebar component for both Super Admin and Tenant Admin panels.
 *
 * Provides consistent navigation with theme-based styling, collapsible state,
 * and user profile section with logout functionality.
 *
 * @example
 * ```tsx
 * <AdminSidebar
 *   theme="super-admin"
 *   menuItems={superAdminMenuItems}
 *   userName="John Doe"
 *   userEmail="john@example.com"
 *   headerBadge="SUPER ADMIN"
 * />
 * ```
 */
export function AdminSidebar({
  theme,
  menuItems,
  userName,
  userEmail,
  headerBadge,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const styles = themeStyles[theme];

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await signOut({ callbackUrl: '/auth/login' });
    }
  };

  const isActive = (href: string) => {
    // Get the base path for exact matching on root admin routes
    const basePath = theme === 'super-admin' ? '/super-admin' : '/tenant-admin';
    if (href === basePath) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          // Base styles
          'text-white flex flex-col transition-all duration-300 ease-in-out relative h-full',
          // Gradient background
          `bg-gradient-to-b ${styles.gradient}`,
          // Width handling
          collapsed ? 'w-20' : 'w-64',
          // Mobile: fixed overlay, Desktop: static
          'fixed md:static inset-y-0 left-0 z-50',
          // Mobile visibility
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', styles.logoBg)}>
                <span className={cn('font-bold text-lg', styles.logoAccent)}>B</span>
              </div>
              <h1 className="text-xl font-bold">BudStack</h1>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden md:block"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
            aria-label="Close navigation menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Role/Tenant Badge */}
        {!collapsed && headerBadge && (
          <div className="px-6 pb-4">
            <div className={cn(
              'rounded-lg px-3 py-1.5 backdrop-blur-sm',
              styles.badgeBg,
              styles.badgeText
            )}>
              {headerBadge}
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
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg transition-all group relative',
                  active
                    ? styles.activeItem
                    : cn('text-white/80', styles.hoverBg, 'hover:text-white')
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    active ? styles.activeIcon : 'text-white/70 group-hover:text-white'
                  )}
                />
                {!collapsed && (
                  <span className={cn('font-medium', active ? 'text-white' : 'text-white/90')}>
                    {item.label}
                  </span>
                )}
                {/* Collapsed tooltip */}
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
        <div className={cn('p-4 border-t', styles.borderColor)}>
          {!collapsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold shadow-lg bg-gradient-to-br',
                    styles.avatarGradient
                  )}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                  <p className="text-xs text-white/70 truncate">{userEmail}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                  styles.buttonBg
                )}
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

      {/* Mobile hamburger button - rendered outside sidebar for layout contexts */}
      <MobileMenuButton onOpen={() => setMobileOpen(true)} isOpen={mobileOpen} theme={theme} />
    </>
  );
}

/**
 * Props for the mobile menu button component
 */
interface MobileMenuButtonProps {
  /** Callback when button is clicked to open the sidebar */
  onOpen: () => void;
  /** Current open state of the mobile sidebar */
  isOpen: boolean;
  /** Theme to match the sidebar styling */
  theme: AdminTheme;
}

/**
 * Mobile menu button gradient styles by theme
 */
const mobileButtonStyles = {
  'super-admin': 'from-slate-700 to-slate-900',
  'tenant-admin': 'from-cyan-600 to-indigo-700',
} as const;

/**
 * Hamburger button for opening the sidebar on mobile devices.
 * Only visible on screens smaller than md breakpoint.
 */
function MobileMenuButton({ onOpen, isOpen, theme }: MobileMenuButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        'fixed top-4 left-4 z-30 p-2 bg-gradient-to-br text-white rounded-lg shadow-lg md:hidden',
        mobileButtonStyles[theme]
      )}
      aria-label="Open navigation menu"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

export default AdminSidebar;
