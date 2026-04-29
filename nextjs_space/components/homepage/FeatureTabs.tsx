"use client";

import Link from "next/link";
import { useState } from "react";
import StorefrontPreview from "./StorefrontPreview";
import BigDashboard from "./BigDashboard";

type TabKey = "storefront" | "dashboard" | "compliance" | "logistics";

const TABS: { key: TabKey; label: string }[] = [
    { key: "storefront", label: "Storefront" },
    { key: "dashboard", label: "Dashboard" },
    { key: "compliance", label: "Compliance" },
    { key: "logistics", label: "Logistics" },
];

const CONTENT: Record<
    TabKey,
    { title: string; body: string; cta: string; href: string; external?: boolean }
> = {
    storefront: {
        title: "A white-label storefront that looks amazing — ready in a day.",
        body: "Your subdomain, your domain, or both. Six branding tabs, custom CSS, SEO controls, AB-ready layouts. Launch in hours — iterate every day.",
        cta: "Explore storefront →",
        href: "/marketplace",
    },
    dashboard: {
        title: "One console. Every patient. Every gram. Every region.",
        body: "Real-time orders, KYC queues, inventory, margin and patient cohorts — wired to Dr. Green's prescription rails. No spreadsheets.",
        cta: "See the console →",
        href: "/marketplace",
    },
    compliance: {
        title: "Dr. Green's compliance, surfaced in your dashboard.",
        body: "Dr. Green holds the INFARMED licence and EU-GMP certificate, with seed-to-sale tracking on an immutable blockchain ledger. We pipe every audit trail straight into your storefront and dashboard — you sell, they keep the regulators happy.",
        cta: "How Dr. Green stays compliant →",
        href: "https://dr.green",
        external: true,
    },
    logistics: {
        title: "Dr. Green ships. You sell.",
        body: "Vetted couriers, signed chain-of-custody and proof of receipt — Dr. Green's logistics partners run the cold chain end-to-end. Your dashboard tracks every consignment in real time, no extra plumbing.",
        cta: "See Dr. Green's network →",
        href: "https://dr.green",
        external: true,
    },
};

export default function FeatureTabs() {
    const [active, setActive] = useState<TabKey>("storefront");
    const c = CONTENT[active];

    return (
        <section
            id="features"
            className="bg-bs-bg-0 px-5 py-20 sm:px-10 sm:py-28 lg:px-20 lg:py-32"
        >
            <div className="mx-auto max-w-[1280px]">
                {/* Section eyebrow + headline */}
                <span className="bs-eyebrow bs-eyebrow-green">The Stack</span>
                <h2 className="mt-3 max-w-[820px] font-bs-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-bs-gold-300 sm:text-[44px] lg:text-[56px] xl:text-[64px]">
                    Four layers that would take months to build.
                </h2>

                {/* Tab strip — horizontal scroll on mobile */}
                <div
                    role="tablist"
                    aria-label="Platform stack layers"
                    className="mt-10 flex gap-1 overflow-x-auto border-b border-bs-border [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                >
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={active === t.key}
                            onClick={() => setActive(t.key)}
                            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-[14px] font-medium transition ${
                                active === t.key
                                    ? "border-bs-green-400 text-bs-fg-0"
                                    : "border-transparent text-bs-fg-2 hover:text-bs-fg-1"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
                    <div className="lg:pt-6">
                        <h3 className="font-bs-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-bs-gold-300 sm:text-[36px] lg:text-[44px]">
                            {c.title}
                        </h3>
                        <p className="mt-5 max-w-[520px] text-[16px] leading-[1.55] text-bs-fg-1 sm:text-[17px]">
                            {c.body}
                        </p>
                        {c.external ? (
                            <a
                                href={c.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bs-btn-ghost mt-7"
                            >
                                {c.cta}
                            </a>
                        ) : (
                            <Link href={c.href} className="bs-btn-ghost mt-7">
                                {c.cta}
                            </Link>
                        )}
                    </div>

                    <div className="flex justify-center">
                        {active === "storefront" && <StorefrontPreview />}
                        {active === "dashboard" && (
                            <div className="w-full max-w-[500px]">
                                <BigDashboard compact />
                            </div>
                        )}
                        {active === "compliance" && <ComplianceCard kind="compliance" />}
                        {active === "logistics" && <ComplianceCard kind="logistics" />}
                    </div>
                </div>
            </div>
        </section>
    );
}

function ComplianceCard({ kind }: { kind: "compliance" | "logistics" }) {
    const items =
        kind === "compliance"
            ? [
                  { tag: "INFARMED", note: "Dr. Green holds the Portuguese cultivation + import licence" },
                  { tag: "EU-GMP", note: "Certified manufacturing chain-of-custody and lab releases" },
                  { tag: "Blockchain", note: "Immutable seed-to-sale ledger — every strain verifiable" },
                  { tag: "GDPR", note: "End-to-end encrypted patient data, consent + residency" },
              ]
            : [
                  { tag: "Licensed Couriers", note: "Dr. Green's vetted partners across PT, ZA, TH; UK & DE next" },
                  { tag: "Chain of Custody", note: "Tamper-evident packaging, signed pickup-to-drop" },
                  { tag: "Proof of Receipt", note: "Patient ID + signature, attached to the order record" },
                  { tag: "Live Tracking", note: "Status streamed into your dashboard end-to-end" },
              ];

    return (
        <div className="bs-card w-full max-w-[520px] p-6 sm:p-8">
            <div className="grid gap-3">
                {items.map((it) => (
                    <div
                        key={it.tag}
                        className="flex items-start gap-3 rounded-xl border border-bs-border bg-bs-bg-2 p-3.5"
                    >
                        <span className="bs-chip bs-chip-green shrink-0">{it.tag}</span>
                        <p className="text-[13.5px] leading-[1.45] text-bs-fg-1">{it.note}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
