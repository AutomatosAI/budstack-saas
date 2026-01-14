import { Metadata } from "next";
import Link from "next/link";
import { Scale, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Terms of Service | Popcorn Media",
    description: "Terms and conditions for using our services",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen canvas-bg">
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
                            Last updated: January 14, 2025
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
                                    By accessing and using Popcorn Media services, you accept and agree to be bound
                                    by these Terms of Service and all applicable laws and regulations.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    2. Eligibility
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    You must be of legal age and hold a valid Dr. Green NFT license to access franchise
                                    services. Medical dispensary customers must have a valid medical prescription as required
                                    by applicable regulations.
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
                                    Franchise operators must comply with all Popcorn Media guidelines, maintain regulatory
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
