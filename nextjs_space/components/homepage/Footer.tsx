import Link from "next/link";
import Image from "next/image";
import { Linkedin, Twitter } from "lucide-react";
import { CookiePreferencesLink } from "@/components/legal/CookiePreferencesLink";

const COLUMNS = [
    {
        title: "Product",
        links: [
            { label: "The Stack", href: "/#features" },
            { label: "The Numbers", href: "/#pricing" },
            { label: "Marketplace", href: "/marketplace" },
            { label: "Guides", href: "/documents" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "Blog", href: "/blog" },
            { label: "Contact", href: "/contact" },
        ],
    },
] as const;

const LEGAL_LINKS = [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "AUP", href: "/aup" },
    { label: "DPA", href: "/dpa" },
    { label: "Cookies", href: "/cookies" },
    { label: "Changelog", href: "/legal/changelog" },
    { label: "Sub-processors", href: "/legal/subprocessors" },
    { label: "Cookie preferences", href: "#cookie-preferences" },
] as const;

const SOCIALS = [
    { label: "X/Twitter", href: "#", Icon: Twitter },
    { label: "LinkedIn", href: "#", Icon: Linkedin },
    {
        label: "Discord",
        href: "#",
        Icon: (props: React.SVGProps<SVGSVGElement>) => (
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                {...props}
            >
                <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.075.075 0 0 0-.079.037c-.34.6-.71 1.39-.96 2.005a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.97-2.005.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-3.76 1.169.07.07 0 0 0-.032.027C2.05 7.95 1.39 11.42 1.71 14.85a.083.083 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.027c.462-.63.872-1.295 1.225-1.994a.076.076 0 0 0-.041-.105 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.04.106c.36.698.77 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-3.97-.838-7.41-3.548-10.454a.06.06 0 0 0-.031-.028zM8.02 12.99c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
        ),
    },
] as const;

export default function Footer() {
    return (
        <footer className="px-3 pb-6 pt-20 sm:px-6 sm:pt-24">
            <div className="bs-pill-footer mx-auto max-w-[1320px] rounded-[28px] px-6 pb-7 pt-10 sm:px-12 sm:pt-11">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-[2fr_1fr_1fr_2fr] md:gap-10">
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

                        {/* Dr.Green partnership badge */}
                        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-bs-green-400/20 bg-bs-green-400/[0.04] py-1.5 pl-1.5 pr-4">
                            <Image
                                src="/images/homepage/drgreen-skull.png"
                                alt="Dr. Green"
                                width={36}
                                height={36}
                                className="h-7 w-7 shrink-0 [filter:drop-shadow(0_0_8px_rgba(82,217,122,0.4))]"
                            />
                            <span className="font-bs-mono text-[10.5px] uppercase leading-tight tracking-[0.14em] text-bs-green-300">
                                Official SaaS Partner
                                <br />
                                <span className="text-bs-fg-2">of Dr. Green</span>
                            </span>
                        </div>

                        {/* Social icons */}
                        <div className="mt-6 flex items-center gap-2.5">
                            {SOCIALS.map(({ label, href, Icon }) => (
                                <Link
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-bs-green-400/20 bg-bs-green-400/[0.04] text-bs-fg-2 transition hover:border-bs-green-400/40 hover:bg-bs-green-400/10 hover:text-bs-green-300"
                                >
                                    <Icon className="h-4 w-4" />
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Product / Company columns */}
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

                    {/* Legal column — single column on mobile to avoid jagged wraps, two columns on desktop */}
                    <div>
                        <span className="bs-eyebrow">Legal</span>
                        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                            {LEGAL_LINKS.map((l) => (
                                <li key={l.label}>
                                    {l.href === "#cookie-preferences" ? (
                                        <CookiePreferencesLink />
                                    ) : (
                                        <Link
                                            href={l.href}
                                            className="text-[13.5px] text-bs-fg-1 transition hover:text-bs-fg-0"
                                        >
                                            {l.label}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
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

                {/* Compliance line — B2B platform disclaimer */}
                <p className="mt-4 max-w-[920px] text-[11px] leading-[1.55] text-bs-fg-3">
                    BudStacks is a B2B SaaS platform for licensed cannabis operators. We do not sell,
                    advertise, or recommend cannabis products to consumers. Operators are solely responsible
                    for regulatory compliance in their jurisdictions.
                </p>
            </div>
        </footer>
    );
}
