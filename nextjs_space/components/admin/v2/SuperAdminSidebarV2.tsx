"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    UserPlus,
    BarChart3,
    Palette,
    Layout,
    Settings,
    Mail,
    GraduationCap,
    ChevronLeft,
    ChevronRight,
    Menu,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
    href: string;
    badge?: string;
}

const MENU: MenuItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/super-admin" },
    { id: "tenants", label: "Tenants", icon: Building2, href: "/super-admin/tenants" },
    { id: "onboarding", label: "Onboarding", icon: UserPlus, href: "/super-admin/onboarding" },
    { id: "analytics", label: "Analytics", icon: BarChart3, href: "/super-admin/analytics" },
    { id: "branding", label: "Branding", icon: Palette, href: "/super-admin/platform-settings" },
    { id: "templates", label: "Store Themes", icon: Layout, href: "/super-admin/templates" },
    { id: "learning", label: "Learning Center", icon: GraduationCap, href: "/super-admin/learning" },
    { id: "emails", label: "Email Templates", icon: Mail, href: "/super-admin/emails" },
    { id: "settings", label: "Settings", icon: Settings, href: "/super-admin/settings" },
];

interface Props {
    userName: string;
    userEmail: string;
}

/**
 * Super-Admin Sidebar v2 — dark variant.
 *
 * Uses .budstacks-theme bs-* tokens. Active item: green left-accent strip + tint.
 * Layout matches v1 (collapse, mobile drawer) so muscle memory is preserved.
 */
export function SuperAdminSidebarV2({ userName, userEmail }: Props) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const isActive = (href: string) => {
        if (href === "/super-admin") return pathname === href;
        return pathname.startsWith(href);
    };

    return (
        <div className="budstacks-theme">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={cn(
                    "flex flex-col transition-all duration-300 ease-in-out min-h-screen",
                    "bg-bs-bg-0 border-r border-bs-border",
                    "shadow-[2px_0_12px_-6px_rgba(0,0,0,0.6)]",
                    collapsed ? "w-20" : "w-64",
                    "fixed md:sticky md:top-0 inset-y-0 left-0 z-50",
                    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                )}
            >
                {/* Header / logo */}
                <div className="p-5 flex items-center justify-between border-b border-bs-border">
                    {!collapsed && (
                        <Link href="/" className="flex items-center" aria-label="Budstacks home">
                            <Image
                                src="/images/homepage/budstacks-horizontal.png"
                                alt="Budstacks"
                                width={150}
                                height={38}
                                className="h-8 w-auto [filter:drop-shadow(0_0_14px_rgba(82,217,122,0.3))]"
                            />
                        </Link>
                    )}
                    {collapsed && (
                        <Link href="/" className="mx-auto" aria-label="Budstacks home">
                            <Image
                                src="/images/homepage/budstacks-cube.png"
                                alt="Budstacks"
                                width={32}
                                height={32}
                                className="h-8 w-8 [filter:drop-shadow(0_0_10px_rgba(82,217,122,0.4))]"
                            />
                        </Link>
                    )}
                    {/* Collapse — desktop only */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-2 hover:bg-bs-bg-2 rounded-lg transition-colors hidden md:block text-bs-fg-3"
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </button>
                    {/* Mobile close */}
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-2 hover:bg-bs-bg-2 rounded-lg transition-colors md:hidden text-bs-fg-3"
                        aria-label="Close sidebar"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                </div>

                {/* Super-admin badge */}
                {!collapsed && (
                    <div className="px-5 pt-4">
                        <span className="font-bs-mono text-[10px] uppercase tracking-[0.16em] text-bs-green-300">
                            Super Admin
                        </span>
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {MENU.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                                    active
                                        ? "bg-bs-green-400/10 text-bs-fg-0"
                                        : "text-bs-fg-2 hover:bg-bs-bg-2 hover:text-bs-fg-1",
                                )}
                                title={collapsed ? item.label : undefined}
                                aria-current={active ? "page" : undefined}
                            >
                                {/* Active accent strip */}
                                {active && (
                                    <span
                                        aria-hidden
                                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-bs-green-400"
                                    />
                                )}
                                <Icon
                                    className={cn(
                                        "h-5 w-5 transition-colors flex-shrink-0",
                                        active ? "text-bs-green-300" : "text-bs-fg-3 group-hover:text-bs-fg-1",
                                    )}
                                />
                                {!collapsed && (
                                    <>
                                        <span className="text-sm font-medium flex-1">{item.label}</span>
                                        {item.badge && (
                                            <span className="rounded-full bg-bs-green-500 px-2 py-0.5 text-[10px] font-semibold text-bs-bg-0">
                                                {item.badge}
                                            </span>
                                        )}
                                    </>
                                )}
                                {collapsed && (
                                    <div className="absolute left-full ml-2 px-2 py-1 bg-bs-bg-2 text-bs-fg-0 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-bs-border">
                                        {item.label}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Profile footer */}
                <div className="p-4 border-t border-bs-border">
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-bs-bg-0 text-sm shrink-0 bg-gradient-to-br from-bs-green-400 to-bs-green-500">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-bs-fg-1 truncate">{userName}</p>
                                <p className="text-xs text-bs-fg-3 truncate">{userEmail}</p>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        <div
                            className="w-10 h-10 mx-auto rounded-full flex items-center justify-center font-semibold text-bs-bg-0 text-sm bg-gradient-to-br from-bs-green-400 to-bs-green-500"
                            title={`${userName} — ${userEmail}`}
                        >
                            {userName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </aside>

            {/* Mobile hamburger */}
            {!mobileOpen && (
                <button
                    onClick={() => setMobileOpen(true)}
                    className="fixed top-4 left-4 z-50 p-2.5 bg-bs-bg-1 border border-bs-border text-bs-fg-1 rounded-xl shadow-lg md:hidden"
                    aria-label="Open sidebar"
                >
                    <Menu className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}
