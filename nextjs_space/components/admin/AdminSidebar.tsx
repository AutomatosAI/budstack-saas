"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface AdminMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  shortcut?: string[];
  badge?: string;
}

export type AdminTheme = "super-admin" | "tenant-admin";
export type AdminAccent = "gold" | "green";

export interface AdminSidebarProps {
  theme: AdminTheme;
  accent: AdminAccent;
  menuItems: AdminMenuItem[];
  userName: string;
  userEmail: string;
  headerBadge?: string;
}

const ACTIVE_RAIL: Record<AdminAccent, string> = {
  gold: "before:bg-bs-gold",
  green: "before:bg-bs-green",
};

const ACTIVE_ICON: Record<AdminAccent, string> = {
  gold: "text-bs-gold",
  green: "text-bs-green",
};

const FOCUS_RING: Record<AdminTheme, string> = {
  "super-admin": "focus-super-admin",
  "tenant-admin": "focus-tenant-admin",
};

export function AdminSidebar({
  theme,
  accent,
  menuItems,
  userName,
  userEmail,
  headerBadge,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    const basePath = theme === "super-admin" ? "/super-admin" : "/tenant-admin";
    if (href === basePath) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-bs-bg-smoke/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out min-h-screen",
          "bg-bs-bg-smoke border-r border-bs-border-100",
          collapsed ? "w-20" : "w-64",
          "fixed md:sticky md:top-0 inset-y-0 left-0 z-50",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-5 flex items-center justify-between border-b border-bs-border-100">
          {!collapsed && (
            <Link href="/" className={cn("flex items-center gap-2.5 rounded", FOCUS_RING[theme])}>
              <div>
                <Image
                  src="/images/homepage/budstacks-horizontal.png"
                  alt="Budstacks"
                  width={140}
                  height={32}
                  priority
                  className="h-7 w-auto [filter:drop-shadow(0_0_10px_rgba(82,217,122,0.35))]"
                />
                {headerBadge && (
                  <span className="mt-1 block font-mono text-mono-eyebrow uppercase text-bs-fg-muted">
                    {headerBadge}
                  </span>
                )}
              </div>
            </Link>
          )}
          {collapsed && (
            <div className="mx-auto">
              <Image
                src="/images/homepage/budstacks-cube.png"
                alt="Budstacks"
                width={32}
                height={32}
                priority
                className="h-8 w-8 object-contain [filter:drop-shadow(0_0_10px_rgba(82,217,122,0.35))]"
              />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-2 rounded-bs-md transition-colors hidden md:block",
              "text-bs-fg-muted hover:text-bs-fg hover:bg-bs-card",
              FOCUS_RING[theme]
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className={cn(
              "p-2 rounded-bs-md transition-colors md:hidden",
              "text-bs-fg-muted hover:text-bs-fg hover:bg-bs-card",
              FOCUS_RING[theme]
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

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
                  "flex items-center gap-3 px-3 py-2.5 rounded-bs-md transition-all group relative",
                  "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:transition-all",
                  active
                    ? cn("bg-bs-card text-bs-fg", ACTIVE_RAIL[accent])
                    : "before:bg-transparent text-bs-fg-muted hover:text-bs-fg hover:bg-bs-card",
                  FOCUS_RING[theme]
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors flex-shrink-0",
                    active ? ACTIVE_ICON[accent] : "text-bs-fg-muted group-hover:text-bs-fg"
                  )}
                />
                {!collapsed && (
                  <>
                    <span
                      className={cn(
                        "text-sm font-medium flex-1",
                        active ? "text-bs-fg" : ""
                      )}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="rounded-bs-pill bg-bs-green/15 text-bs-green-soft border border-bs-green/30 px-2 py-0.5 font-mono text-mono-chip uppercase">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-bs-card border border-bs-border text-bs-fg text-xs rounded-bs-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-bs-card">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-bs-border-100">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bs-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bs-fg truncate">
                  {userName}
                </p>
                <p className="text-xs text-bs-fg-muted truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobileMenuButton
        onOpen={() => setMobileOpen(true)}
        isOpen={mobileOpen}
        focusClass={FOCUS_RING[theme]}
      />
    </>
  );
}

interface MobileMenuButtonProps {
  onOpen: () => void;
  isOpen: boolean;
  focusClass: string;
}

function MobileMenuButton({ onOpen, isOpen, focusClass }: MobileMenuButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "fixed top-4 left-4 z-50 p-2.5 rounded-bs-md md:hidden",
        "bg-bs-card border border-bs-border text-bs-fg shadow-bs-card",
        focusClass
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export default AdminSidebar;
