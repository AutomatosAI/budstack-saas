import { Metadata } from "next";
import Link from "next/link";
import { Scale, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { generatePlatformRouteMetadata } from "@/lib/seo/generate-platform-metadata";

// US-015 — read from `platform_seo_settings`, falling back per column to the
// title and description this page used to hardcode (now in
// PLATFORM_ROUTE_FALLBACKS, keyed by the same path the admin list edits).
export function generateMetadata(): Promise<Metadata> {
    return generatePlatformRouteMetadata("/terms");
}

const SECTIONS = [
    {
        id: "platform-role",
        title: "1. Platform role and operator responsibility",
        body: (
            <>
                <p>
                    BudStacks is a B2B SaaS infrastructure platform for licensed cannabis operators.
                    We do not sell, advertise, dispense, or recommend cannabis or cannabis products
                    to consumers. Our customers are licensed operators who are solely responsible
                    for regulatory compliance in their jurisdictions, including holding all required
                    licences and permits.
                </p>
                <p>
                    By accessing or using BudStacks, you agree to be bound by these Terms of Service,
                    the{" "}
                    <Link href="/aup" className="text-bs-green-300 underline-offset-2 hover:underline">
                        Acceptable Use Policy
                    </Link>
                    , the{" "}
                    <Link href="/privacy" className="text-bs-green-300 underline-offset-2 hover:underline">
                        Privacy Policy
                    </Link>
                    , and (where applicable) the{" "}
                    <Link href="/dpa" className="text-bs-green-300 underline-offset-2 hover:underline">
                        Data Processing Agreement
                    </Link>
                    . If you do not agree, do not use the service.
                </p>
            </>
        ),
    },
    {
        id: "eligibility",
        title: "2. Eligibility",
        body: (
            <>
                <p>To use BudStacks as an operator, you represent and warrant that:</p>
                <ul>
                    <li>You are of legal age in your jurisdiction.</li>
                    <li>
                        You hold a valid operating licence (clinic, pharmacy, dispensary, or
                        equivalent) for the activity you intend to conduct on the platform, and
                        will maintain that licence in good standing throughout the contract.
                    </li>
                    <li>
                        You have authority to bind the entity you represent.
                    </li>
                    <li>
                        Your use of the platform complies with all applicable laws, including
                        those of the United Kingdom (MHRA, Human Medicines Regulations 2012),
                        Portugal (INFARMED), South Africa (SAHPRA), and other relevant
                        regulators.
                    </li>
                    <li>
                        You are not located in, organised under, or ordinarily resident in a
                        sanctioned jurisdiction; you are not on any government denied-parties
                        list.
                    </li>
                </ul>
                <p>
                    End-customers of operator storefronts are subject to the operator's own
                    eligibility criteria, including age verification and prescription requirements.
                </p>
            </>
        ),
    },
    {
        id: "accounts",
        title: "3. Accounts and security",
        body: (
            <>
                <p>
                    You are responsible for maintaining the confidentiality of your account
                    credentials and all activity conducted under your account. You must use strong
                    passwords, enable multi-factor authentication where offered, and notify us
                    immediately at{" "}
                    <a href="mailto:security@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        security@budstacks.io
                    </a>{" "}
                    of any suspected unauthorised access.
                </p>
            </>
        ),
    },
    {
        id: "operator-obligations",
        title: "4. Operator obligations and compliance",
        body: (
            <>
                <p>
                    As an operator using the platform, you agree to:
                </p>
                <ul>
                    <li>
                        <strong>Hold and maintain all required licences</strong> for the activities
                        you conduct on your storefront.
                    </li>
                    <li>
                        <strong>Comply with marketing and advertising rules</strong> for cannabis
                        products in your jurisdiction, including the UK Human Medicines Regulations
                        2012 (Regulation 279) and the MHRA Blue Guide where applicable. Do not
                        publish therapeutic, curative, or treatment claims for unlicensed medicinal
                        cannabis products.
                    </li>
                    <li>
                        <strong>Comply with platform advertising policies</strong> of Meta, LinkedIn,
                        Google, TikTok, and others, when promoting your storefront via those
                        channels. BudStacks does not buy or run advertising on your behalf.
                    </li>
                    <li>
                        <strong>Implement age verification (18+ or 21+ per local law)</strong> on
                        your storefront before checkout.
                    </li>
                    <li>
                        <strong>Verify prescriptions</strong> and conduct KYC where required by
                        local regulation before fulfilling orders.
                    </li>
                    <li>
                        <strong>Display required disclaimers</strong> and disclosures, including
                        operator licence numbers, product disclaimers, and consumer rights notices.
                    </li>
                    <li>
                        <strong>Be the controller</strong> of all personal data of your end-customers
                        and patients; comply with the GDPR / UK GDPR; sign and abide by the DPA.
                    </li>
                    <li>
                        <strong>Indemnify BudStacks</strong> against regulatory action, claims, or
                        losses arising from your storefront operations, marketing, content, or
                        regulatory non-compliance, except to the extent caused by BudStacks'
                        material breach of these Terms.
                    </li>
                </ul>
                <p>
                    BudStacks may suspend or terminate accounts that breach these obligations or
                    create regulatory or reputational risk to the platform.
                </p>
            </>
        ),
    },
    {
        id: "fees",
        title: "5. Fees, billing and taxes",
        body: (
            <>
                <p>
                    Subscription fees, transaction fees and any usage charges are stated in your
                    order form or pricing page at the time of purchase. Fees are exclusive of taxes;
                    you are responsible for all applicable VAT, GST, sales taxes, and withholding.
                    Late payments may incur interest at the statutory rate. We may revise prices on
                    renewal with at least 30 days' written notice.
                </p>
            </>
        ),
    },
    {
        id: "service-availability",
        title: "6. Service availability and changes",
        body: (
            <>
                <p>
                    We aim for high availability but do not guarantee uninterrupted service. We may
                    perform maintenance, deploy updates, and modify or deprecate features. Material
                    feature deprecations affecting paid functionality will be announced at least 90
                    days in advance. Specific uptime commitments, where offered, are set out in the
                    relevant service order or service-level agreement.
                </p>
            </>
        ),
    },
    {
        id: "ip",
        title: "7. Intellectual property",
        body: (
            <>
                <p>
                    BudStacks retains all rights, title, and interest in the platform, including
                    code, design, documentation, brand assets, and trademarks. You retain ownership
                    of your content (logos, copy, product data, customer data). You grant BudStacks
                    a limited, non-exclusive licence to host, display, and process your content
                    solely to provide the service.
                </p>
                <p>
                    Third-party brand marks displayed on the platform — including those of Dr. Green
                    — remain the property of their respective owners. BudStacks displays such marks
                    under permission of the relevant licensor where applicable.
                </p>
            </>
        ),
    },
    {
        id: "prohibited",
        title: "8. Prohibited uses",
        body: (
            <>
                <p>
                    You may not use the platform in any way that:
                </p>
                <ul>
                    <li>Violates applicable law (including narcotics, advertising, data protection, or sanctions law).</li>
                    <li>
                        Promotes, lists, or facilitates the sale of cannabis to consumers in
                        jurisdictions where such sale is illegal.
                    </li>
                    <li>
                        Makes therapeutic, curative or medical-treatment claims about products that
                        are not authorised medicines.
                    </li>
                    <li>
                        Targets minors or fails to age-gate content where required by local law.
                    </li>
                    <li>Probes, scans, or attempts to penetrate platform security; circumvents rate limits or licensing controls.</li>
                    <li>Uploads malicious code, transmits spam, or scrapes other tenants' data.</li>
                    <li>Infringes the intellectual-property or privacy rights of any party.</li>
                </ul>
                <p>
                    The full list of prohibited conduct is in the{" "}
                    <Link href="/aup" className="text-bs-green-300 underline-offset-2 hover:underline">
                        Acceptable Use Policy
                    </Link>
                    , incorporated by reference into these Terms.
                </p>
            </>
        ),
    },
    {
        id: "warranties",
        title: "9. Disclaimers and warranties",
        body: (
            <>
                <p>
                    The platform is provided "as is" and "as available". To the maximum extent
                    permitted by law, BudStacks disclaims all implied warranties of merchantability,
                    fitness for a particular purpose, non-infringement, and accuracy. BudStacks does
                    not warrant that the platform will be uninterrupted, error-free, or secure
                    against all threats.
                </p>
            </>
        ),
    },
    {
        id: "liability",
        title: "10. Limitation of liability",
        body: (
            <>
                <p>
                    To the maximum extent permitted by law, BudStacks' aggregate liability arising
                    out of or related to these Terms shall not exceed the fees paid by you to
                    BudStacks in the 12 months preceding the event giving rise to liability.
                    BudStacks is not liable for indirect, incidental, special, consequential, or
                    punitive damages, lost profits, or lost data. Regulatory fines, penalties, and
                    enforcement costs arising from operator activity are excluded from BudStacks'
                    liability and are the sole responsibility of the operator.
                </p>
                <p>
                    Nothing in these Terms excludes or limits liability for fraud, gross negligence,
                    or any other liability that cannot be excluded by applicable law.
                </p>
            </>
        ),
    },
    {
        id: "term-termination",
        title: "11. Term and termination",
        body: (
            <>
                <p>
                    These Terms remain in effect while you use the platform. Either party may
                    terminate for material breach not cured within 30 days of written notice.
                    BudStacks may terminate or suspend immediately if you breach the Acceptable Use
                    Policy, fail to pay, lose required licences, or create material regulatory or
                    reputational risk. On termination, you may export your data for 30 days, after
                    which we delete or return it per the DPA.
                </p>
            </>
        ),
    },
    {
        id: "changes",
        title: "12. Changes to these Terms",
        body: (
            <>
                <p>
                    Material changes are recorded in the{" "}
                    <Link href="/legal/changelog" className="text-bs-green-300 underline-offset-2 hover:underline">
                        legal changelog
                    </Link>{" "}
                    and we will notify you by email at least 30 days before they take effect.
                    Continued use after the effective date constitutes acceptance.
                </p>
            </>
        ),
    },
    {
        id: "law",
        title: "13. Governing law and disputes",
        body: (
            <>
                <p>
                    These Terms are governed by the laws of Portugal, without regard to conflict-of-laws
                    rules. The courts of Lisbon, Portugal have exclusive jurisdiction over any dispute,
                    subject to mandatory consumer-protection provisions of your country of residence.
                </p>
            </>
        ),
    },
    {
        id: "contact",
        title: "14. Contact",
        body: (
            <>
                <p>
                    Legal:{" "}
                    <a href="mailto:legal@budstacks.io" className="text-bs-green-300 underline-offset-2 hover:underline">
                        legal@budstacks.io
                    </a>
                    <br />
                    Postal: Budstacks Lda, Lisbon, Portugal
                </p>
            </>
        ),
    },
];

export default function TermsPage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />

            <main className="px-4 pt-32 pb-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Header */}
                    <div className="mb-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <Scale className="h-4 w-4" />
                                Legal
                            </div>
                        </div>
                        <h1 className="font-bs-serif text-3xl font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-4xl md:text-5xl">
                            Terms of Service
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-bs-fg-2">
                            Last updated: April 25, 2026
                        </p>
                    </div>


                    {/* Content Card */}
                    <div className="card-floating p-10 lg:p-12">
                        <div className="bs-article max-w-none">
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
                        <Link href="/privacy" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Privacy Policy
                        </Link>
                        <Link href="/aup" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Acceptable Use Policy
                        </Link>
                        <Link href="/cookies" className="text-sm text-bs-fg-2 hover:text-bs-green-300 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Cookie Policy
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
