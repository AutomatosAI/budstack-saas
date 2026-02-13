"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popcorn, User, Menu } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

export default function Navbar() {
    const [open, setOpen] = useState(false);

    const NavItems = () => (
        <>
            <a
                href="/#features"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
            >
                Features
            </a>
            <a
                href="/#models"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
            >
                Models
            </a>
            <a
                href="/#pricing"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
            >
                Pricing
            </a>
            <Link
                href="/blog"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
            >
                Blog
            </Link>
            <Link
                href="/contact"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
            >
                Contact
            </Link>
        </>
    );

    return (
        <nav className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div
                    className="mt-4 flex h-16 items-center justify-between rounded-[1.25rem] bg-card px-6 border border-border/50"
                    style={{
                        background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
                        boxShadow: `
              0 1px 3px rgba(15, 23, 42, 0.06),
              0 8px 20px rgba(15, 23, 42, 0.08),
              0 20px 50px rgba(15, 23, 42, 0.12)
            `,
                    }}
                >
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Trigger */}
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden -ml-2">
                                    <Menu className="h-5 w-5 text-muted-foreground" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                                <SheetHeader>
                                    <SheetTitle className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                                            <Popcorn className="h-4 w-4 text-accent-foreground" />
                                        </div>
                                        BudStack
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8">
                                    <NavItems />
                                    <div className="border-t pt-4 mt-2">
                                        <Link href="/auth/login" onClick={() => setOpen(false)}>
                                            <Button className="w-full mb-2" variant="outline">Log In</Button>
                                        </Link>
                                        <Link href="/onboarding" onClick={() => setOpen(false)}>
                                            <Button className="w-full btn-elevated" variant="hero">Get Started</Button>
                                        </Link>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>

                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                                <Popcorn className="h-5 w-5 text-accent-foreground" />
                            </div>
                            <span className="font-sans-heading text-lg font-bold text-foreground hidden sm:inline-block">
                                BudStack
                            </span>
                        </Link>
                    </div>

                    {/* Navigation Links (Desktop) */}
                    <div className="hidden items-center gap-8 md:flex">
                        <NavItems />
                    </div>

                    {/* Right side: Profile + CTA */}
                    <div className="flex items-center gap-3">
                        {/* Profile/Login icon */}
                        <Link href="/auth/login">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full hover:bg-slate-100"
                            >
                                <User className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </Link>

                        {/* CTA Button */}
                        <Link href="/onboarding" className="hidden sm:block">
                            <Button variant="hero" size="default" className="btn-elevated">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
