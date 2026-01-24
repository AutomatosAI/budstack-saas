import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popcorn, User } from "lucide-react";

export default function Navbar() {
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
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                            <Popcorn className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <span className="font-sans-heading text-lg font-bold text-foreground">
                            BudStack
                        </span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden items-center gap-8 md:flex">
                        <a
                            href="/#features"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Features
                        </a>
                        <a
                            href="/#models"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Models
                        </a>
                        <a
                            href="/#pricing"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Pricing
                        </a>
                        <Link
                            href="/blog"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Blog
                        </Link>
                        <Link
                            href="/contact"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Contact
                        </Link>
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
