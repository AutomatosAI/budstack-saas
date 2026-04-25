import Link from "next/link";
import Image from "next/image";

const COLUMNS = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "/#features" },
            { label: "Marketplace", href: "/marketplace" },
            { label: "Pricing", href: "/#pricing" },
            { label: "Dashboard", href: "/auth/login" },
            { label: "Changelog", href: "/learn" },
        ],
    },
    {
        title: "Operators",
        links: [
            { label: "Apply for licence", href: "/onboarding" },
            { label: "Log in", href: "/auth/login" },
            { label: "Playbook", href: "/learn" },
            { label: "The Wire", href: "/blog" },
        ],
    },
    {
        title: "Partnership",
        links: [
            { label: "Dr. Green", href: "/contact" },
            { label: "NFT licence", href: "/learn" },
            { label: "Compliance", href: "/regulatory" },
            { label: "Regions", href: "/#global" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About", href: "/contact" },
            { label: "Contact", href: "/contact" },
            { label: "Press", href: "/blog" },
            { label: "Legal", href: "/privacy" },
        ],
    },
] as const;

export default function Footer() {
    return (
        <footer className="px-3 pb-6 pt-20 sm:px-6 sm:pt-24">
            <div className="bs-pill-footer mx-auto max-w-[1320px] rounded-[28px] px-6 pb-7 pt-10 sm:px-12 sm:pt-11">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:gap-10">
                    {/* Brand col */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="inline-flex items-center" aria-label="Budstacks home">
                            <Image
                                src="/images/homepage/budstacks-horizontal.png"
                                alt="Budstacks"
                                width={170}
                                height={44}
                                className="h-9 w-auto [filter:drop-shadow(0_0_14px_rgba(82,217,122,0.3))]"
                            />
                        </Link>
                        <p className="mt-4 max-w-[260px] text-[13.5px] leading-[1.55] text-bs-fg-2">
                            The rollout platform for Dr. Green franchise operators.
                        </p>
                        <span className="bs-chip bs-chip-gold mt-5">
                            <span className="dot" />
                            Official SaaS Partner
                        </span>
                    </div>

                    {/* Link columns */}
                    {COLUMNS.map((col) => (
                        <div key={col.title}>
                            <span className="bs-eyebrow">{col.title}</span>
                            <ul className="mt-4 flex flex-col gap-2.5">
                                {col.links.map((l) => (
                                    <li key={l.label}>
                                        <Link
                                            href={l.href}
                                            className="text-[13.5px] text-bs-fg-1 transition hover:text-bs-fg-0"
                                        >
                                            {l.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom row */}
                <div className="mt-10 flex flex-col gap-3 border-t border-bs-green-400/15 pt-5 text-[12px] sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bs-mono text-bs-fg-3">
                        © {new Date().getFullYear()} Budstacks. All rights reserved.
                    </span>
                    <span className="font-bs-mono uppercase tracking-[0.16em] text-bs-fg-3">
                        Built in Portugal · Operating Globally
                    </span>
                </div>
            </div>
        </footer>
    );
}
