"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Menu, LogOut, Shield, Store, LayoutDashboard, User } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { label: string; href: string; isRoute?: boolean };

const NAV_ITEMS: readonly NavItem[] = [
    { label: "Features", href: "/#features" },
    { label: "Models", href: "/#models" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Marketplace", href: "/marketplace", isRoute: true },
    { label: "Docs", href: "/learn", isRoute: true },
    { label: "Blog", href: "/blog", isRoute: true },
    { label: "Contact", href: "/contact", isRoute: true },
];

export default function Nav() {
    const [open, setOpen] = useState(false);
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();

    const role = user?.publicMetadata?.role as string | undefined;

    const getDashboardUrl = () => {
        if (role === "SUPER_ADMIN") return "/super-admin";
        if (role === "TENANT_ADMIN") return "/tenant-admin";
        return "/auth/callback";
    };

    const handleSignOut = async () => {
        await signOut({ redirectUrl: "/" });
    };

    const NavLinks = ({ onClick }: { onClick?: () => void }) => (
        <>
            {NAV_ITEMS.map((item) =>
                item.isRoute ? (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClick}
                        className="rounded-full px-3.5 py-2 text-[13.5px] text-bs-fg-1 transition hover:bg-bs-green-400/10 hover:text-bs-fg-0"
                    >
                        {item.label}
                    </Link>
                ) : (
                    <a
                        key={item.href}
                        href={item.href}
                        onClick={onClick}
                        className="rounded-full px-3.5 py-2 text-[13.5px] text-bs-fg-1 transition hover:bg-bs-green-400/10 hover:text-bs-fg-0"
                    >
                        {item.label}
                    </a>
                )
            )}
        </>
    );

    return (
        <nav className="sticky top-3 sm:top-[18px] z-50 w-full px-3 sm:px-6">
            <div className="bs-pill-nav mx-auto flex h-14 sm:h-[68px] w-full max-w-[1320px] items-center justify-between gap-3 rounded-full pl-4 pr-3 sm:pl-[22px] sm:pr-[14px]">
                {/* Left: mobile menu + logo */}
                <div className="flex items-center gap-2">
                    {/* Mobile menu trigger */}
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <button
                                className="flex h-9 w-9 items-center justify-center rounded-full text-bs-fg-1 transition hover:bg-bs-green-400/10 md:hidden"
                                aria-label="Toggle menu"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent
                            side="left"
                            className="w-[300px] border-r border-bs-border bg-bs-bg-1 sm:w-[360px]"
                        >
                            <SheetHeader>
                                <SheetTitle className="flex items-center text-bs-fg-0">
                                    <Image
                                        src="/images/homepage/budstacks-horizontal.png"
                                        alt="Budstacks"
                                        width={140}
                                        height={36}
                                        priority
                                        className="h-9 w-auto"
                                    />
                                </SheetTitle>
                            </SheetHeader>
                            <div className="mt-8 flex flex-col gap-1">
                                <NavLinks onClick={() => setOpen(false)} />
                            </div>
                            <div className="mt-6 border-t border-bs-border pt-6">
                                {isLoaded && isSignedIn ? (
                                    <div className="flex flex-col gap-2">
                                        <Link href={getDashboardUrl()} onClick={() => setOpen(false)}>
                                            <button className="bs-btn-ghost w-full justify-center">
                                                <LayoutDashboard className="h-4 w-4" />
                                                Dashboard
                                            </button>
                                        </Link>
                                        <button
                                            className="bs-btn-ghost w-full justify-center"
                                            onClick={() => {
                                                setOpen(false);
                                                handleSignOut();
                                            }}
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Log out
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Link href="/auth/login" onClick={() => setOpen(false)}>
                                            <button className="bs-btn-ghost w-full justify-center">
                                                Operator log-in
                                            </button>
                                        </Link>
                                        <Link href="/onboarding" onClick={() => setOpen(false)}>
                                            <button className="bs-btn-green w-full justify-center">
                                                Apply for license →
                                            </button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>

                    <Link href="/" className="flex items-center" aria-label="Budstacks home">
                        <Image
                            src="/images/homepage/budstacks-horizontal.png"
                            alt="Budstacks"
                            width={170}
                            height={44}
                            priority
                            className="h-8 w-auto sm:h-11 [filter:drop-shadow(0_0_14px_rgba(82,217,122,0.4))]"
                        />
                    </Link>
                </div>

                {/* Center: desktop nav links */}
                <div className="hidden items-center gap-1 md:flex">
                    <NavLinks />
                </div>

                {/* Right: auth + CTA */}
                <div className="flex items-center gap-1 sm:gap-2">
                    {isLoaded && isSignedIn ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-bs-green-400/10"
                                    aria-label="Account menu"
                                >
                                    {user?.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={user.imageUrl}
                                            alt="Profile"
                                            className="h-7 w-7 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bs-green-500 text-[13px] font-medium text-bs-bg-0">
                                            {user?.firstName?.[0] ||
                                                user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
                                                "U"}
                                        </div>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-56 border-bs-border bg-bs-bg-1 text-bs-fg-0"
                            >
                                <div className="px-2 py-1.5">
                                    <p className="text-sm font-medium text-bs-fg-0">{user?.fullName || "User"}</p>
                                    <p className="text-xs text-bs-fg-2">
                                        {user?.primaryEmailAddress?.emailAddress}
                                    </p>
                                </div>
                                <DropdownMenuSeparator className="bg-bs-border" />
                                {role === "SUPER_ADMIN" && (
                                    <DropdownMenuItem
                                        onClick={() => router.push("/super-admin")}
                                        className="cursor-pointer text-bs-fg-1 focus:bg-bs-green-400/10 focus:text-bs-fg-0"
                                    >
                                        <Shield className="mr-2 h-4 w-4" />
                                        Super Admin
                                    </DropdownMenuItem>
                                )}
                                {(role === "TENANT_ADMIN" || role === "SUPER_ADMIN") && (
                                    <DropdownMenuItem
                                        onClick={() => router.push("/tenant-admin")}
                                        className="cursor-pointer text-bs-fg-1 focus:bg-bs-green-400/10 focus:text-bs-fg-0"
                                    >
                                        <Store className="mr-2 h-4 w-4" />
                                        Store Dashboard
                                    </DropdownMenuItem>
                                )}
                                {(!role || role === "CONSUMER" || role === "PATIENT") && (
                                    <DropdownMenuItem
                                        onClick={() => router.push("/auth/callback")}
                                        className="cursor-pointer text-bs-fg-1 focus:bg-bs-green-400/10 focus:text-bs-fg-0"
                                    >
                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                        My Dashboard
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-bs-border" />
                                <DropdownMenuItem
                                    onClick={handleSignOut}
                                    className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Link
                            href="/auth/login"
                            className="hidden rounded-full px-3 py-2 text-[13.5px] text-bs-fg-1 transition hover:text-bs-fg-0 sm:inline-flex"
                        >
                            Operator log-in
                        </Link>
                    )}

                    {/* Apply CTA — always visible (signed-in users can still apply for additional licences) */}
                    <Link href="/onboarding" className="hidden sm:block">
                        <button className="bs-btn-green !py-2.5 !px-4 text-[13px]">
                            Apply for license →
                        </button>
                    </Link>

                    {/* Mobile signed-out fallback: just a user icon → /auth/login */}
                    {isLoaded && !isSignedIn && (
                        <Link
                            href="/auth/login"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-bs-fg-1 transition hover:bg-bs-green-400/10 sm:hidden"
                            aria-label="Operator log-in"
                        >
                            <User className="h-5 w-5" />
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
