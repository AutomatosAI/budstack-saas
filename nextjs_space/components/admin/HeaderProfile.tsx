"use client";

import Link from "next/link";
import { User, LogOut, Shield, Store } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProfileProps {
    theme?: "super-admin" | "tenant-admin";
}

export function HeaderProfile({ theme = "tenant-admin" }: HeaderProfileProps) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();

    const role = user?.publicMetadata?.role as string | undefined;
    const profileUrl = theme === "super-admin" ? "/super-admin/profile" : "/tenant-admin/profile";

    const handleLogout = async () => {
        await signOut({ redirectUrl: "/auth/login" });
    };

    if (!isLoaded) return null;

    const focusRing = theme === "super-admin" ? "focus-super-admin" : "focus-tenant-admin";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={`ml-4 flex items-center justify-center w-9 h-9 rounded-full outline-none transition-colors bg-bs-card border border-bs-border text-bs-fg-body hover:text-bs-fg hover:border-bs-fg-muted ${focusRing}`}>
                {user?.imageUrl ? (
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        className="w-9 h-9 rounded-full object-cover"
                    />
                ) : (
                    <User className="h-4 w-4" />
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-56 bg-bs-card border-bs-border text-bs-fg-body shadow-bs-card-hover"
            >
                <DropdownMenuLabel className="font-mono text-mono-eyebrow uppercase text-bs-fg-muted">
                    My Account
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-bs-border-100" />
                {/* Dashboard shortcuts based on role */}
                {role === "SUPER_ADMIN" && theme !== "super-admin" && (
                    <DropdownMenuItem asChild>
                        <Link
                            href="/super-admin"
                            className="cursor-pointer w-full flex items-center text-bs-fg-body hover:text-bs-fg focus:bg-bs-hover focus:text-bs-fg"
                        >
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Super Admin</span>
                        </Link>
                    </DropdownMenuItem>
                )}
                {(role === "SUPER_ADMIN" || role === "TENANT_ADMIN") && theme !== "tenant-admin" && (
                    <DropdownMenuItem asChild>
                        <Link
                            href="/tenant-admin"
                            className="cursor-pointer w-full flex items-center text-bs-fg-body hover:text-bs-fg focus:bg-bs-hover focus:text-bs-fg"
                        >
                            <Store className="mr-2 h-4 w-4" />
                            <span>Store Dashboard</span>
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <Link
                        href={profileUrl}
                        className="cursor-pointer w-full flex items-center text-bs-fg-body hover:text-bs-fg focus:bg-bs-hover focus:text-bs-fg"
                    >
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-bs-border-100" />
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-bs-danger focus:text-bs-danger focus:bg-bs-danger/10"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
