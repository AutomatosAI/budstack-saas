import { Metadata } from "next";
import Link from "next/link";
import { Scale, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Terms of Service | BudStacks",
    description: "Terms and conditions for using our services",
};

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
                        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                            Terms of Service
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                            Last updated: April 25, 2026
                        </p>
                    </div>

                    {/* Content Card */}
                    <div className="card-floating p-10 lg:p-12">
                        <div className="prose prose-lg max-w-none">
                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    1. Acceptance of Terms
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    BudStacks is a B2B SaaS infrastructure platform for licensed cannabis
                                    operators. We do not sell, advertise, dispense, or recommend cannabis or
                                    cannabis products to consumers. Our customers are licensed operators who
                                    are solely responsible for regulatory compliance in their jurisdictions.
                                    By accessing and using BudStacks services, you accept and agree to be bound
                                    by these Terms of Service and all applicable laws and regulations.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    2. Eligibility
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    You must be of legal age and hold a valid operating licence in your
                                    jurisdiction (clinic, pharmacy, dispensary, or equivalent) to access
                                    operator services. End-customers of our partner storefronts must meet
                                    their operator's own eligibility requirements, including a valid
                                    prescription where required by applicable regulations.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    3. Account Responsibilities
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    You are responsible for maintaining the confidentiality of your account credentials
                                    and all activities conducted under your account. Notify us immediately of any unauthorized use.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    4. Franchise Obligations
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    Franchise operators must comply with all BudStacks guidelines, maintain regulatory
                                    compliance, and operate within the bounds of their license agreement.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    5. Prohibited Uses
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    You may not use our service for any unlawful purpose, in violation of applicable
                                    regulations, or in any manner that could damage or impair the service.
                                </p>
                            </section>

                            <section>
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    6. Termination
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    We reserve the right to terminate or suspend access to our service immediately,
                                    without prior notice, for violations of these terms or applicable law.
                                </p>
                            </section>
                        </div>
                    </div>

                    {/* Related Links */}
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/privacy" className="text-sm text-muted-foreground hover:text-accent flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Privacy Policy
                        </Link>
                        <Link href="/cookies" className="text-sm text-muted-foreground hover:text-accent flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Cookie Policy
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
