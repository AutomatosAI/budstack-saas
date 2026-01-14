import { Metadata } from "next";
import Link from "next/link";
import { Cookie, FileText, Settings, BarChart3, Shield } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Cookie Policy | Popcorn Media",
    description: "Information about cookies and how we use them",
};

const cookieTypes = [
    {
        icon: Shield,
        title: "Essential Cookies",
        description: "Required for basic site functionality, authentication, and security. Cannot be disabled.",
        examples: ["Session cookies", "Security tokens", "Load balancing"],
    },
    {
        icon: BarChart3,
        title: "Analytics Cookies",
        description: "Help us understand how visitors interact with our website to improve user experience.",
        examples: ["Page views", "Traffic sources", "User journey"],
    },
    {
        icon: Settings,
        title: "Preference Cookies",
        description: "Remember your settings and preferences for a personalized experience.",
        examples: ["Language settings", "Theme preferences", "Dashboard layout"],
    },
];

export default function CookiesPage() {
    return (
        <div className="min-h-screen canvas-bg">
            <Navbar />

            <main className="px-4 pt-32 pb-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Header */}
                    <div className="mb-12 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <Cookie className="h-4 w-4" />
                                Legal
                            </div>
                        </div>
                        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                            Cookie Policy
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                            Last updated: January 14, 2025
                        </p>
                    </div>

                    {/* Intro Card */}
                    <div className="card-floating p-10 lg:p-12 mb-8">
                        <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                            What Are Cookies?
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Cookies are small text files stored on your device when you visit our website.
                            They help us provide you with a better experience by remembering your preferences,
                            keeping you signed in, and helping us understand how you use our platform.
                        </p>
                    </div>

                    {/* Cookie Types Grid */}
                    <div className="grid gap-6 md:grid-cols-3 mb-8">
                        {cookieTypes.map((type) => (
                            <div key={type.title} className="card-floating p-6">
                                <div className="icon-badge mb-4">
                                    <type.icon className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                                    {type.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                    {type.description}
                                </p>
                                <ul className="space-y-1">
                                    {type.examples.map((example) => (
                                        <li key={example} className="text-xs text-muted-foreground flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                                            {example}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Managing Cookies Card */}
                    <div className="card-floating p-10 lg:p-12">
                        <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                            Managing Cookies
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mb-6">
                            You can control and delete cookies through your browser settings. Most browsers
                            allow you to block or delete cookies. However, please note that disabling certain
                            cookies may affect the functionality of our website.
                        </p>
                        <div className="rounded-2xl bg-slate-100 border border-slate-200 p-5">
                            <p className="text-sm text-slate-600">
                                <strong>Note:</strong> Essential cookies cannot be disabled as they are necessary
                                for the website to function properly. For more information about your privacy rights,
                                see our{" "}
                                <Link href="/privacy" className="text-accent hover:underline">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </div>
                    </div>

                    {/* Related Links */}
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/privacy" className="text-sm text-muted-foreground hover:text-accent flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="text-sm text-muted-foreground hover:text-accent flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
