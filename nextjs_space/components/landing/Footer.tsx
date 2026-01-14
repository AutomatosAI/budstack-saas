import Link from "next/link";
import { Popcorn } from "lucide-react";

const footerLinks = {
    product: {
        title: "Product",
        links: [
            { label: "Features", href: "/#features" },
            { label: "Pricing", href: "/#pricing" },
            { label: "Management Models", href: "/#models" },
        ],
    },
    company: {
        title: "Company",
        links: [
            { label: "About", href: "#" },
            { label: "Contact", href: "/contact", isRoute: true },
            { label: "Blog", href: "/blog", isRoute: true },
        ],
    },
    socials: {
        title: "Socials",
        links: [
            { label: "X/Twitter", href: "#" },
            { label: "LinkedIn", href: "#" },
            { label: "Discord", href: "#" },
        ],
    },
    legal: {
        title: "Legal",
        links: [
            { label: "Privacy", href: "/privacy", isRoute: true },
            { label: "Terms", href: "/terms", isRoute: true },
            { label: "Cookies", href: "/cookies", isRoute: true },
        ],
    },
};

export default function Footer() {
    return (
        <footer className="px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div
                    className="rounded-[1.5rem] border border-border/50 bg-card px-8 py-12 lg:px-12"
                    style={{
                        background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
                        boxShadow: `
              0 1px 3px rgba(15, 23, 42, 0.06),
              0 8px 20px rgba(15, 23, 42, 0.08),
              0 20px 50px rgba(15, 23, 42, 0.12)
            `,
                    }}
                >
                    <div className="grid gap-8 lg:grid-cols-6">
                        {/* Brand column */}
                        <div className="lg:col-span-2">
                            <Link href="/" className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                                    <Popcorn className="h-5 w-5 text-accent-foreground" />
                                </div>
                                <span className="font-sans-heading text-lg font-bold text-foreground">
                                    Popcorn Media
                                </span>
                            </Link>
                            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                                The Shopify for medical cannabis. Professional franchise
                                infrastructure partnering with Dr. Green.
                            </p>
                            <p className="mt-4 text-xs text-muted-foreground">
                                Powered by Automatos AI
                            </p>
                        </div>

                        {/* Links columns */}
                        {Object.values(footerLinks).map((section) => (
                            <div key={section.title}>
                                <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {section.title}
                                </h4>
                                <ul className="space-y-3">
                                    {section.links.map((link) => (
                                        <li key={link.label}>
                                            {"isRoute" in link && link.isRoute ? (
                                                <Link
                                                    href={link.href}
                                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    {link.label}
                                                </Link>
                                            ) : (
                                                <a
                                                    href={link.href}
                                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    {link.label}
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Bottom row */}
                    <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
                        <p className="text-sm text-muted-foreground">
                            © 2026 Popcorn Media. All rights reserved.
                        </p>
                        <a
                            href="#"
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            Back to top ↑
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
