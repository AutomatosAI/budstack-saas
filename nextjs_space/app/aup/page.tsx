import { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Acceptable Use Policy | BudStacks",
    description: "Rules governing acceptable use of the BudStacks platform by operators and end users.",
};

const SECTIONS = [
    {
        id: "scope",
        title: "1. Scope",
        body: (
            <>
                <p>
                    This Acceptable Use Policy ("AUP") applies to everyone who uses the BudStacks
                    platform, including operators, their staff, end-customers, and visitors. It is
                    incorporated by reference into the{" "}
                    <Link href="/terms" className="text-bs-green-300 underline-offset-2 hover:underline">
                        Terms of Service
                    </Link>
                    . Breach of this AUP may result in immediate suspension or termination.
                </p>
            </>
        ),
    },
    {
        id: "regulatory",
        title: "2. Regulatory compliance",
        body: (
            <>
                <p>You may not use the platform to:</p>
                <ul>
                    <li>
                        Sell, advertise, supply, or facilitate the sale of cannabis or cannabis
                        products to consumers in jurisdictions where such activity is illegal.
                    </li>
                    <li>
                        Make therapeutic, curative, or medical-treatment claims about products that
                        are not authorised medicines in the relevant jurisdiction. This includes
                        claims that specific strains "treat", "cure", or "relieve" specific medical
                        conditions, in breach of UK Human Medicines Regulations 2012 Regulation 279
                        and the MHRA Blue Guide.
                    </li>
                    <li>
                        Operate a storefront without a valid local operating licence.
                    </li>
                    <li>
                        Bypass age verification, prescription validation, KYC, or any other
                        regulatory control required by local law.
                    </li>
                    <li>
                        Pay for or run advertising on Meta, LinkedIn, Google, TikTok or any other
                        channel in breach of those platforms' policies on cannabis or restricted
                        goods.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: "content",
        title: "3. Content rules for operator storefronts",
        body: (
            <>
                <p>Storefronts hosted on BudStacks must:</p>
                <ul>
                    <li>
                        Implement an age gate (18+ or 21+ per local law) before product browsing or
                        checkout.
                    </li>
                    <li>
                        Display the operator's licence number, registered address, and complaints
                        contact.
                    </li>
                    <li>
                        Avoid promotional language that markets cannabis to consumers in non-compliant
                        ways (e.g. "buy now", "best high", "limited stock — order today!").
                    </li>
                    <li>
                        Not use imagery of cannabis flower, smoking, or recreational consumption in
                        marketing copy where prohibited by local rules or platform policies.
                    </li>
                    <li>
                        Not promote discounts, sales, or special offers in ways that breach local
                        cannabis advertising restrictions.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: "security",
        title: "4. Security and integrity",
        body: (
            <>
                <p>You may not:</p>
                <ul>
                    <li>Probe, scan, or attempt to penetrate platform security.</li>
                    <li>Bypass authentication, rate limits, or feature gates.</li>
                    <li>Upload malware, viruses, or any code intended to disrupt the platform.</li>
                    <li>Access data belonging to other tenants without authorisation.</li>
                    <li>Reverse-engineer or copy proprietary parts of the platform.</li>
                    <li>Scrape data at volumes or rates that degrade service for others.</li>
                </ul>
            </>
        ),
    },
    {
        id: "lawful",
        title: "5. Lawful and ethical use",
        body: (
            <>
                <p>You may not use the platform to:</p>
                <ul>
                    <li>Send spam or unsolicited bulk communications.</li>
                    <li>Infringe intellectual property, privacy, or publicity rights.</li>
                    <li>Defame, harass, or threaten others.</li>
                    <li>Distribute illegal content (CSAM, terrorist content, etc.).</li>
                    <li>Engage in fraud, money-laundering, or other financial crime.</li>
                    <li>Trade with sanctioned individuals or jurisdictions.</li>
                </ul>
            </>
        ),
    },
    {
        id: "data",
        title: "6. Data handling",
        body: (
            <>
                <p>
                    Operators are controllers of patient and customer data and must comply with the
                    GDPR / UK GDPR. Operators must not upload special-category data (Article 9)
                    without a lawful basis. Operators must respond to data-subject requests in line
                    with statutory deadlines. Sharing of patient data with unauthorised third
                    parties is strictly prohibited.
                </p>
            </>
        ),
    },
    {
        id: "reporting",
        title: "7. Reporting violations",
        body: (
            <>
                <p>
                    To report suspected AUP violations, email{" "}
                    <a href="mailto:abuse@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        abuse@budstacks.io
                    </a>
                    . Security vulnerabilities should be reported to{" "}
                    <a href="mailto:security@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        security@budstacks.io
                    </a>
                    .
                </p>
            </>
        ),
    },
    {
        id: "enforcement",
        title: "8. Enforcement",
        body: (
            <>
                <p>
                    BudStacks may, at its sole discretion: warn the operator, request remediation,
                    suspend accounts or storefronts, remove content, terminate the agreement,
                    cooperate with law-enforcement, and report suspected criminal conduct to the
                    appropriate authorities. Where a breach is also a breach of the Terms of
                    Service, BudStacks reserves all rights and remedies under those Terms and
                    applicable law.
                </p>
            </>
        ),
    },
];

export default function AupPage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />
            <main className="px-4 pt-32 pb-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <ShieldAlert className="h-4 w-4" />
                                Legal
                            </div>
                        </div>
                        <h1 className="font-bs-serif text-3xl font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-4xl md:text-5xl">
                            Acceptable Use Policy
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-bs-fg-2">
                            Last updated: April 25, 2026
                        </p>
                    </div>


                    <div className="card-floating p-10 lg:p-12">
                        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bs-serif prose-headings:text-bs-fg-0 prose-p:text-bs-fg-2 prose-li:text-bs-fg-2 prose-strong:text-bs-fg-1 prose-a:text-bs-green-300">
                            {SECTIONS.map((s) => (
                                <section key={s.id} id={s.id} className="mb-10 last:mb-0">
                                    <h2 className="font-bs-serif text-2xl font-medium text-bs-fg-0 mb-4">
                                        {s.title}
                                    </h2>
                                    <div className="leading-relaxed text-bs-fg-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1.5 [&_p]:mb-3">
                                        {s.body}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/terms" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Terms of Service
                        </Link>
                        <Link href="/privacy" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
