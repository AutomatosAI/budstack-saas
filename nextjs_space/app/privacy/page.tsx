import { Metadata } from "next";
import Link from "next/link";
import { Shield, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { LegalDraftNotice } from "@/components/legal/LegalDraftNotice";

export const metadata: Metadata = {
    title: "Privacy Policy | BudStacks",
    description: "How BudStacks collects, processes and protects personal data on behalf of operators and visitors.",
};

const SECTIONS = [
    {
        id: "scope",
        title: "1. Scope and roles",
        body: (
            <>
                <p>
                    BudStacks is a B2B Software-as-a-Service platform operated by Budstacks Lda
                    ("BudStacks", "we", "us"). This policy explains how we handle personal data in
                    two distinct capacities:
                </p>
                <ul>
                    <li>
                        <strong>As controller</strong> — for personal data relating to website visitors,
                        prospective customers, billing contacts, and operator administrators (e.g.
                        people who interact with budstack.to, sign up, contact us, or sign in to
                        manage a tenant).
                    </li>
                    <li>
                        <strong>As processor</strong> — for personal data that licensed operators
                        ("operators", "tenants") store on the platform about their own end-customers
                        and patients. The operator is the controller of that data; BudStacks
                        processes it only on the operator's documented instructions, in accordance
                        with the Data Processing Agreement (
                        <Link href="/dpa" className="text-bs-green-300 underline-offset-2 hover:underline">
                            DPA
                        </Link>
                        ).
                    </li>
                </ul>
                <p>
                    BudStacks is not a healthcare provider, pharmacy, or dispensary. We do not sell,
                    advertise, dispense, or recommend cannabis or cannabis products to consumers.
                </p>
            </>
        ),
    },
    {
        id: "data-collected",
        title: "2. Personal data we collect (as controller)",
        body: (
            <>
                <p>When you interact with BudStacks directly, we collect:</p>
                <ul>
                    <li>
                        <strong>Account data:</strong> name, email, organisation, role, password
                        credentials handled by our authentication provider (Clerk).
                    </li>
                    <li>
                        <strong>Billing data:</strong> billing contact, VAT/tax number, payment
                        method tokens (handled by our payment processor; we do not store full card
                        numbers).
                    </li>
                    <li>
                        <strong>Communications:</strong> emails, support tickets, contact form
                        submissions.
                    </li>
                    <li>
                        <strong>Technical data:</strong> IP address, browser, device, pages visited,
                        timestamps. Collected via essential cookies for security and via analytics
                        cookies only with your consent.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: "operator-data",
        title: "3. Personal data we process on operators' behalf (as processor)",
        body: (
            <>
                <p>
                    When operators use BudStacks to run their storefronts, we process the data they
                    upload or that flows through the platform, which may include:
                </p>
                <ul>
                    <li>End-customer / patient identifiers, contact details, addresses</li>
                    <li>
                        <strong>Special category data (GDPR Article 9):</strong> health-related data
                        such as prescriptions, condition references, KYC verifications
                    </li>
                    <li>Order, payment, and shipment metadata</li>
                    <li>Authentication and audit data</li>
                </ul>
                <p>
                    The operator is the controller. BudStacks processes this data strictly as
                    instructed by the operator under the DPA, including the Article 28(3)
                    obligations: confidentiality, security, sub-processor controls, breach
                    notification, audit cooperation, and deletion / return of data on termination.
                </p>
                <p>
                    Patients and end-customers seeking to exercise their rights should contact the
                    operator directly (the operator is their controller). BudStacks will assist the
                    operator in responding.
                </p>
            </>
        ),
    },
    {
        id: "purposes-bases",
        title: "4. Purposes and lawful bases (as controller)",
        body: (
            <>
                <p>We process your personal data for the following purposes and lawful bases:</p>
                <ul>
                    <li>
                        <strong>Provide and operate the service</strong> — performance of contract
                        (GDPR Article 6(1)(b))
                    </li>
                    <li>
                        <strong>Respond to enquiries and support requests</strong> — performance of
                        contract / legitimate interests (Article 6(1)(b)/(f))
                    </li>
                    <li>
                        <strong>Send service and security notifications</strong> — performance of
                        contract / legal obligation (Article 6(1)(b)/(c))
                    </li>
                    <li>
                        <strong>Send marketing emails</strong> — consent (Article 6(1)(a)); opt-out
                        in every message
                    </li>
                    <li>
                        <strong>Analytics on website usage</strong> — consent (Article 6(1)(a)) via
                        cookie banner
                    </li>
                    <li>
                        <strong>Comply with legal, tax, accounting and regulatory obligations</strong> —
                        legal obligation (Article 6(1)(c))
                    </li>
                    <li>
                        <strong>Defend legal claims and protect platform integrity</strong> —
                        legitimate interests (Article 6(1)(f))
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: "subprocessors",
        title: "5. Sub-processors and recipients",
        body: (
            <>
                <p>
                    We use vetted sub-processors to deliver the service. The current list,
                    including each vendor's purpose, region, and transfer mechanism, is published at{" "}
                    <Link href="/legal/subprocessors" className="text-bs-green-300 underline-offset-2 hover:underline">
                        /legal/subprocessors
                    </Link>
                    . Operators are notified of material additions or changes at least 30 days
                    before they take effect, and may object as set out in the DPA.
                </p>
                <p>
                    We do not sell personal data. We share data only with sub-processors, with
                    public authorities where required by law, or with your explicit instruction.
                </p>
            </>
        ),
    },
    {
        id: "transfers",
        title: "6. International transfers",
        body: (
            <>
                <p>
                    Personal data may be transferred outside the EEA / UK to sub-processors in the
                    United States and other jurisdictions. Where transfers occur, we rely on
                    appropriate safeguards: EU Standard Contractual Clauses (and the UK addendum),
                    adequacy decisions where applicable, and additional technical and organisational
                    measures. Specific transfer mechanisms are listed alongside each sub-processor.
                </p>
            </>
        ),
    },
    {
        id: "retention",
        title: "7. Retention",
        body: (
            <>
                <p>We retain personal data only for as long as necessary for the purposes above:</p>
                <ul>
                    <li>Active account data — duration of the contract</li>
                    <li>Billing and tax records — 10 years (legal obligation)</li>
                    <li>Support tickets — 3 years</li>
                    <li>Audit logs — 12 months unless a longer period is required by law or contract</li>
                    <li>Marketing data — until you opt out or 24 months of inactivity</li>
                    <li>Operator-controlled data — per the operator's instructions and DPA</li>
                </ul>
            </>
        ),
    },
    {
        id: "security",
        title: "8. Security",
        body: (
            <>
                <p>
                    We implement appropriate technical and organisational measures including:
                    encryption in transit (TLS 1.2+) and at rest, scoped IAM access, audit logging,
                    isolated tenant data partitions, regular dependency scanning, principle of least
                    privilege, and incident response procedures. We notify operators of personal
                    data breaches affecting their data within 72 hours of discovery.
                </p>
            </>
        ),
    },
    {
        id: "your-rights",
        title: "9. Your rights",
        body: (
            <>
                <p>Under the GDPR / UK GDPR you have the right to:</p>
                <ul>
                    <li>Access the personal data we hold about you</li>
                    <li>Rectify inaccurate or incomplete data</li>
                    <li>Erase data where applicable ("right to be forgotten")</li>
                    <li>Restrict or object to processing</li>
                    <li>Data portability</li>
                    <li>Withdraw consent at any time, where processing is based on consent</li>
                    <li>Lodge a complaint with a supervisory authority (e.g. CNPD in Portugal, ICO in the UK)</li>
                </ul>
                <p>
                    To exercise these rights, email{" "}
                    <a href="mailto:privacy@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        privacy@budstacks.io
                    </a>
                    . If your data is held by an operator (you are their patient or customer), please
                    contact the operator first; we will assist them in responding.
                </p>
            </>
        ),
    },
    {
        id: "cookies",
        title: "10. Cookies and similar technologies",
        body: (
            <>
                <p>
                    We use essential cookies to make the site work, and request your explicit consent
                    for analytics and preference cookies. See our{" "}
                    <Link href="/cookies" className="text-bs-green-300 underline-offset-2 hover:underline">
                        Cookie Policy
                    </Link>{" "}
                    for the full list and to manage your choices.
                </p>
            </>
        ),
    },
    {
        id: "changes",
        title: "11. Changes to this policy",
        body: (
            <>
                <p>
                    Material changes are recorded in the{" "}
                    <Link href="/legal/changelog" className="text-bs-green-300 underline-offset-2 hover:underline">
                        legal changelog
                    </Link>{" "}
                    and operators are notified by email at least 30 days before they take effect.
                </p>
            </>
        ),
    },
    {
        id: "contact",
        title: "12. Contact",
        body: (
            <>
                <p>
                    Privacy enquiries:{" "}
                    <a href="mailto:privacy@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        privacy@budstacks.io
                    </a>
                    <br />
                    Data Protection Officer:{" "}
                    <a href="mailto:dpo@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        dpo@budstacks.io
                    </a>
                    <br />
                    Postal: Budstacks Lda, Lisbon, Portugal
                </p>
            </>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />

            <main className="px-4 pt-32 pb-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Header */}
                    <div className="mb-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <Shield className="h-4 w-4" />
                                Legal
                            </div>
                        </div>
                        <h1 className="font-bs-serif text-3xl font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-4xl md:text-5xl">
                            Privacy Policy
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-bs-fg-2">
                            Last updated: April 25, 2026
                        </p>
                    </div>

                    <LegalDraftNotice documentName="Privacy Policy" />

                    {/* Content Card */}
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

                    {/* Related Links */}
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/terms" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Terms of Service
                        </Link>
                        <Link href="/cookies" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Cookie Policy
                        </Link>
                        <Link href="/dpa" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Data Processing Agreement
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
