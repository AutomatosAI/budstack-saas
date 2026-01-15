"use client";

import Link from "next/link";
import { User, LogOut } from "lucide-react";
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

    const profileUrl = theme === "super-admin" ? "/super-admin/profile" : "/tenant-admin/profile";

    const handleLogout = async () => {
        await signOut({ redirectUrl: "/auth/login" });
    };

    if (!isLoaded) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="ml-4 flex items-center justify-center w-8 h-8 rounded-full outline-none ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {user?.imageUrl ? (
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">
                        <User className="h-5 w-5" />
                    </div>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={profileUrl} className="cursor-pointer w-full flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
