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

interface Props {
    theme?: "super-admin" | "tenant-admin";
}

/**
 * HeaderProfile v2 — dark trigger styling for the v2 admin chrome.
 *
 * The dropdown content renders in a portal at the page root (light theme),
 * so only the trigger (visible in the top bar) is themed dark.
 */
export function HeaderProfileV2({ theme = "super-admin" }: Props) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();

    const role = user?.publicMetadata?.role as string | undefined;
    const profileUrl = theme === "super-admin" ? "/super-admin/profile" : "/tenant-admin/profile";

    const handleLogout = async () => {
        await signOut({ redirectUrl: "/auth/login" });
    };

    if (!isLoaded) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="ml-3 flex items-center justify-center w-9 h-9 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bs-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bs-bg-0"
                aria-label="Account menu"
            >
                {user?.imageUrl ? (
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        className="w-9 h-9 rounded-full object-cover border border-bs-green-400/25"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-bs-bg-2 border border-bs-border flex items-center justify-center text-bs-fg-2 hover:text-bs-green-300 hover:border-bs-green-400/40 transition-colors">
                        <User className="h-5 w-5" />
                    </div>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === "SUPER_ADMIN" && theme !== "super-admin" && (
                    <DropdownMenuItem asChild>
                        <Link href="/super-admin" className="cursor-pointer w-full flex items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Super Admin</span>
                        </Link>
                    </DropdownMenuItem>
                )}
                {(role === "SUPER_ADMIN" || role === "TENANT_ADMIN") && theme !== "tenant-admin" && (
                    <DropdownMenuItem asChild>
                        <Link href="/tenant-admin" className="cursor-pointer w-full flex items-center">
                            <Store className="mr-2 h-4 w-4" />
                            <span>Store Dashboard</span>
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <Link href={profileUrl} className="cursor-pointer w-full flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
