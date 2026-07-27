import { Metadata } from "next";
import Link from "next/link";
import { Clock, Database, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { LegalDraftNotice } from "@/components/legal/LegalDraftNotice";
import { prisma } from "@/lib/db";
import type { SubprocessorRecord } from "@/lib/legal/subprocessor-notice";

export const metadata: Metadata = {
    title: "Sub-processors | BudStacks",
    description: "Vendors that BudStacks engages to deliver the platform — purpose, region, and transfer mechanism.",
};

// The register is database-backed (WS3 US-011). It was a hardcoded array, so it
// could only change with a deploy and nothing could start the 30-day notice
// clock the DPA promises operators.
export const dynamic = "force-dynamic";

export default async function SubprocessorsPage() {
    // Annotated because `prisma` is exported as `any`, so the result would
    // otherwise be untyped and every callback below an implicit `any`.
    const entries: SubprocessorRecord[] = await prisma.subprocessors.findMany({
        where: { status: { in: ["active", "pending"] } },
        orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    // Pending entries are shown deliberately: advance notice is the point, and
    // an operator cannot exercise the objection right over a change they cannot
    // see until it is already in force.
    const pending = entries.filter((entry) => entry.status === "pending");
    const lastChange = entries.reduce<Date | null>(
        (latest: Date | null, entry: SubprocessorRecord) =>
            !latest || entry.updatedAt > latest ? entry.updatedAt : latest,
        null,
    );
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
                            Last updated:{" "}
                            {(lastChange ?? new Date()).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            })}
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

                        {pending.length > 0 && (
                            <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
                                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                                <div className="text-sm">
                                    <p className="font-medium text-bs-fg-0">
                                        {pending.length === 1
                                            ? "One upcoming change"
                                            : `${pending.length} upcoming changes`}
                                    </p>
                                    <p className="mt-1 leading-relaxed text-bs-fg-2">
                                        The vendors marked below are announced but not yet
                                        processing. They are listed here during the notice
                                        period so operators can object before the change
                                        takes effect, rather than after.
                                    </p>
                                </div>
                            </div>
                        )}

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
                                    {entries.map((s: SubprocessorRecord) => (
                                        <tr
                                            key={s.id}
                                            className="border-t border-bs-border align-top text-bs-fg-1"
                                        >
                                            <td className="px-4 py-3 font-medium text-bs-fg-0">
                                                {s.name}
                                                {s.status === "pending" && (
                                                    <span className="ml-2 whitespace-nowrap rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                                                        From{" "}
                                                        {s.effectiveFrom.toLocaleDateString("en-GB", {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-bs-fg-2">{s.purpose}</td>
                                            <td className="px-4 py-3 text-bs-fg-2">{s.region}</td>
                                            <td className="px-4 py-3 text-bs-fg-2">{s.transferMechanism}</td>
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
                            Operators do not need to subscribe to hear about changes. Every
                            active operator is emailed at least 30 days before a vendor is
                            added or replaced, at the contact address on their account —
                            notice you have to opt into is not notice. Changes are also
                            recorded in the{" "}
                            <Link href="/legal/changelog" className="text-bs-green-300 underline-offset-2 hover:underline">
                                legal changelog
                            </Link>
                            . To object to a sub-processor, or to ask anything about this
                            list, contact{" "}
                            <a
                                href="mailto:legal@budstacks.io?subject=Sub-processor%20query"
                                className="text-bs-green-300 underline-offset-2 hover:underline"
                            >
                                legal@budstacks.io
                            </a>
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
