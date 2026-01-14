import { Metadata } from "next";
import Link from "next/link";
import { Shield, FileText } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Privacy Policy | Popcorn Media",
    description: "Our privacy policy and data protection practices",
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen canvas-bg">
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
                        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                            Privacy Policy
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
                                    1. Information We Collect
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    We collect information you provide directly to us, including when you create an account,
                                    place an order, or contact us for support. This may include your name, email address,
                                    phone number, and payment information.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    2. How We Use Your Information
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    We use the information we collect to provide, maintain, and improve our services,
                                    process your orders, communicate with you, and ensure compliance with applicable regulations.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    3. Data Protection
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    We implement appropriate technical and organizational measures to protect your
                                    personal data against unauthorized access, alteration, disclosure, or destruction.
                                    All data is encrypted in transit and at rest.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    4. Your Rights (GDPR)
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    You have the right to access, correct, or delete your personal information.
                                    You may also request data portability or object to processing. Contact us to exercise these rights.
                                </p>
                            </section>

                            <section className="mb-10">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    5. Cookies
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    We use cookies and similar technologies to enhance your browsing experience
                                    and analyze site traffic. See our{" "}
                                    <Link href="/cookies" className="text-accent hover:underline">
                                        Cookie Policy
                                    </Link>{" "}
                                    for more details.
                                </p>
                            </section>

                            <section>
                                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                                    6. Contact Us
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    If you have questions about this Privacy Policy, please contact us at{" "}
                                    <a href="mailto:privacy@popcornmedia.eu" className="text-accent hover:underline">
                                        privacy@popcornmedia.eu
                                    </a>
                                </p>
                            </section>
                        </div>
                    </div>

                    {/* Related Links */}
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/terms" className="text-sm text-muted-foreground hover:text-accent flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Terms of Service
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
