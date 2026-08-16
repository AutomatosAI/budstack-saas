import { Metadata } from "next";
import Link from "next/link";
import { History, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { generatePlatformRouteMetadata } from "@/lib/seo/generate-platform-metadata";

// US-015 — read from `platform_seo_settings`, falling back per column to the
// title and description this page used to hardcode (now in
// PLATFORM_ROUTE_FALLBACKS, keyed by the same path the admin list edits).
export function generateMetadata(): Promise<Metadata> {
    return generatePlatformRouteMetadata("/legal/changelog");
}

interface ChangelogEntry {
    date: string;
    documents: string[];
    summary: string;
}

const ENTRIES: ChangelogEntry[] = [
    {
        date: "April 25, 2026",
        documents: ["Terms", "Privacy", "Cookies", "AUP", "Sub-processors", "DPA"],
        summary:
            "Major rewrite. Added platform/operator role separation, GDPR Article 28 processor terms, sub-processor registry, Acceptable Use Policy, DPA scaffold, and PECR-compliant cookie consent. Pending counsel review before binding publication.",
    },
    {
        date: "April 24, 2026",
        documents: ["Terms", "Footer"],
        summary:
            "Phase 1 quick wins: added B2B platform compliance disclaimer to footer; added platform/operator framing in Terms §1; generalised Terms §2 from Dr. Green NFT to any valid operating licence.",
    },
    {
        date: "January 14, 2025",
        documents: ["Privacy", "Terms", "Cookies"],
        summary: "Initial publication of placeholder legal pages.",
    },
];

export default function LegalChangelogPage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />
            <main className="px-4 pt-32 pb-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <History className="h-4 w-4" />
                                Legal
                            </div>
                        </div>
                        <h1 className="font-bs-serif text-3xl font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-4xl md:text-5xl">
                            Legal changelog
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-bs-fg-2">
                            Material changes to our public legal documents. Operators are notified
                            by email at least 30 days before changes take effect.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {ENTRIES.map((e) => (
                            <article
                                key={e.date}
                                className="card-floating p-6 sm:p-8"
                            >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="font-bs-mono text-[11px] uppercase tracking-[0.14em] text-bs-fg-3">
                                        {e.date}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {e.documents.map((doc) => (
                                            <span
                                                key={doc}
                                                className="rounded-full border border-bs-green-400/25 bg-bs-green-400/10 px-2.5 py-0.5 text-[11px] font-medium text-bs-green-300"
                                            >
                                                {doc}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed text-bs-fg-2">
                                    {e.summary}
                                </p>
                            </article>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                        <Link href="/privacy" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Terms of Service
                        </Link>
                        <Link href="/aup" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            AUP
                        </Link>
                        <Link href="/legal/subprocessors" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Sub-processors
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
