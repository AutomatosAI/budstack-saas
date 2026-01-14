"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Popcorn,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

/**
 * Menu item configuration for the sidebar navigation
 */
export interface AdminMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  shortcut?: string[];
  badge?: string;
}

export type AdminTheme = "super-admin" | "tenant-admin";

export interface AdminSidebarProps {
  theme: AdminTheme;
  menuItems: AdminMenuItem[];
  userName: string;
  userEmail: string;
  headerBadge?: string;
}

/**
 * Flowa Pro Admin Sidebar - Light theme with orange accents
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

  // Close mobile sidebar on route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      await signOut({ callbackUrl: "/auth/login" });
    }
  };

  const isActive = (href: string) => {
    const basePath = theme === "super-admin" ? "/super-admin" : "/tenant-admin";
    if (href === basePath) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Flowa Pro Light Theme */}
      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out min-h-screen",
          // White background with subtle border
          "bg-white border-r border-slate-200",
          // Subtle shadow for depth
          "shadow-[2px_0_8px_-4px_rgba(0,0,0,0.05)]",
          // Width handling
          collapsed ? "w-20" : "w-64",
          // Positioning
          "fixed md:sticky md:top-0 inset-y-0 left-0 z-50",
          // Mobile visibility
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                <Popcorn className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-sans-heading text-base font-bold text-foreground">
                  Popcorn Media
                </h1>
                {headerBadge && (
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {headerBadge}
                  </span>
                )}
              </div>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent mx-auto">
              <Popcorn className="h-5 w-5 text-white" />
            </div>
          )}
          {/* Collapse button - desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden md:block"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors md:hidden"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                  active
                    ? "bg-accent/10 border-l-4 border-accent -ml-px"
                    : "hover:bg-slate-50 text-muted-foreground hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors flex-shrink-0",
                    active ? "text-accent" : "text-slate-500 group-hover:text-foreground"
                  )}
                />
                {!collapsed && (
                  <>
                    <span
                      className={cn(
                        "text-sm font-medium flex-1",
                        active ? "text-foreground" : ""
                      )}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {/* Collapsed tooltip */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-100">
          {!collapsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white text-sm"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userEmail}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-2 hover:bg-slate-100 rounded-xl transition-colors group relative"
              title="Logout"
            >
              <LogOut className="h-5 w-5 mx-auto text-muted-foreground" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Logout
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Mobile hamburger button */}
      <MobileMenuButton
        onOpen={() => setMobileOpen(true)}
        isOpen={mobileOpen}
      />
    </>
  );
}

interface MobileMenuButtonProps {
  onOpen: () => void;
  isOpen: boolean;
}

function MobileMenuButton({ onOpen, isOpen }: MobileMenuButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onOpen}
      className="fixed top-4 left-4 z-50 p-2.5 bg-white border border-slate-200 text-foreground rounded-xl shadow-lg md:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export default AdminSidebar;
