import { Metadata } from "next";
import Link from "next/link";
import { Database, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { LegalDraftNotice } from "@/components/legal/LegalDraftNotice";

export const metadata: Metadata = {
    title: "Sub-processors | BudStacks",
    description: "Vendors that BudStacks engages to deliver the platform — purpose, region, and transfer mechanism.",
};

interface Subprocessor {
    name: string;
    purpose: string;
    region: string;
    transfer: string;
    dpaUrl?: string;
}

const SUBPROCESSORS: Subprocessor[] = [
    {
        name: "Clerk",
        purpose: "Authentication, session management, user identity",
        region: "United States",
        transfer: "EU SCCs + UK addendum",
        dpaUrl: "https://clerk.com/legal/dpa",
    },
    {
        name: "Railway",
        purpose: "Application hosting, build pipelines, deployment",
        region: "United States",
        transfer: "EU SCCs + UK addendum",
        dpaUrl: "https://railway.com/legal/dpa",
    },
    {
        name: "Amazon Web Services (AWS S3)",
        purpose: "Object storage for tenant assets and backups",
        region: "EU (eu-west-1) primary; US for cross-region replication",
        transfer: "EU SCCs + UK addendum",
        dpaUrl: "https://aws.amazon.com/service-terms/",
    },
    {
        name: "PostgreSQL (managed by Railway)",
        purpose: "Primary application database",
        region: "United States (Railway-managed)",
        transfer: "EU SCCs + UK addendum",
    },
    {
        name: "Redis (managed by Railway)",
        purpose: "Cache, session store, background-job queues",
        region: "United States (Railway-managed)",
        transfer: "EU SCCs + UK addendum",
    },
    {
        name: "Stripe",
        purpose: "Payment processing for platform subscription fees",
        region: "United States / Ireland",
        transfer: "EU SCCs + UK addendum; adequacy where applicable",
        dpaUrl: "https://stripe.com/legal/dpa",
    },
    {
        name: "Resend",
        purpose: "Transactional email delivery (system notifications)",
        region: "United States",
        transfer: "EU SCCs + UK addendum",
        dpaUrl: "https://resend.com/legal/dpa",
    },
    {
        name: "Dr. Green API",
        purpose: "Product catalogue and order routing for partner storefronts",
        region: "Portugal / European Union",
        transfer: "Within EEA — no SCCs required",
    },
    {
        name: "Sentry",
        purpose: "Error monitoring and performance telemetry",
        region: "United States / EU",
        transfer: "EU SCCs + UK addendum",
        dpaUrl: "https://sentry.io/legal/dpa/",
    },
];

export default function SubprocessorsPage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />
            <main className="px-4 pt-32 pb-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <Database className="h-4 w-4" />
                                Legal
                            </div>
                        </div>
                        <h1 className="font-bs-serif text-3xl font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-4xl md:text-5xl">
                            Sub-processors
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-bs-fg-2">
                            Last updated: April 25, 2026
                        </p>
                    </div>

                    <LegalDraftNotice documentName="Sub-processor list" />

                    <div className="card-floating p-8 lg:p-10">
                        <p className="mb-8 text-bs-fg-2 leading-relaxed">
                            BudStacks engages the vendors below to deliver the platform. We update
                            this list when we add or replace a vendor, and notify operators by email
                            at least 30 days before changes take effect, in line with the{" "}
                            <Link href="/dpa" className="text-bs-green-300 underline-offset-2 hover:underline">
                                Data Processing Agreement
                            </Link>
                            . Operators may object to a new sub-processor as set out in the DPA.
                        </p>

                        <div className="overflow-x-auto rounded-2xl border border-bs-border">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-bs-bg-2 text-bs-fg-1">
                                    <tr>
                                        <th className="px-4 py-3 font-bs-mono text-[11px] uppercase tracking-[0.14em]">Vendor</th>
                                        <th className="px-4 py-3 font-bs-mono text-[11px] uppercase tracking-[0.14em]">Purpose</th>
                                        <th className="px-4 py-3 font-bs-mono text-[11px] uppercase tracking-[0.14em]">Region</th>
                                        <th className="px-4 py-3 font-bs-mono text-[11px] uppercase tracking-[0.14em]">Transfer</th>
                                        <th className="px-4 py-3 font-bs-mono text-[11px] uppercase tracking-[0.14em]">DPA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SUBPROCESSORS.map((s) => (
                                        <tr
                                            key={s.name}
                                            className="border-t border-bs-border align-top text-bs-fg-1"
                                        >
                                            <td className="px-4 py-3 font-medium text-bs-fg-0">{s.name}</td>
                                            <td className="px-4 py-3 text-bs-fg-2">{s.purpose}</td>
                                            <td className="px-4 py-3 text-bs-fg-2">{s.region}</td>
                                            <td className="px-4 py-3 text-bs-fg-2">{s.transfer}</td>
                                            <td className="px-4 py-3">
                                                {s.dpaUrl ? (
                                                    <a
                                                        href={s.dpaUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-bs-green-300 underline-offset-2 hover:underline"
                                                    >
                                                        View →
                                                    </a>
                                                ) : (
                                                    <span className="text-bs-fg-3">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="mt-8 text-sm text-bs-fg-2 leading-relaxed">
                            To be notified of changes, subscribe by emailing{" "}
                            <a
                                href="mailto:legal@budstacks.io?subject=Subprocessor%20updates%20subscribe"
                                className="text-bs-green-300 underline-offset-2 hover:underline"
                            >
                                legal@budstacks.io
                            </a>
                            . You can also follow updates in the{" "}
                            <Link href="/legal/changelog" className="text-bs-green-300 underline-offset-2 hover:underline">
                                legal changelog
                            </Link>
                            .
                        </p>
                    </div>

                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/privacy" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Privacy Policy
                        </Link>
                        <Link href="/dpa" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            DPA
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
