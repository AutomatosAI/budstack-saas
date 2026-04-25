import Link from "next/link";
import Image from "next/image";

const COLUMNS = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "/#features" },
            { label: "Pricing", href: "/#pricing" },
            { label: "Management Models", href: "/#models" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About", href: "#" },
            { label: "Contact", href: "/contact" },
            { label: "Blog", href: "/blog" },
        ],
    },
    {
        title: "Socials",
        links: [
            { label: "X/Twitter", href: "#" },
            { label: "LinkedIn", href: "#" },
            { label: "Discord", href: "#" },
        ],
    },
    {
        title: "Legal",
        links: [
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
            { label: "Cookies", href: "/cookies" },
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
