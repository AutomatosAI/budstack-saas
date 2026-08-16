import { Metadata } from "next";
import Link from "next/link";
import { Cookie, FileText, Settings, BarChart3, Shield } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { CookiePreferencesLink } from "@/components/legal/CookiePreferencesLink";
import { generatePlatformRouteMetadata } from "@/lib/seo/generate-platform-metadata";

// US-015 — read from `platform_seo_settings`, falling back per column to the
// title and description this page used to hardcode (now in
// PLATFORM_ROUTE_FALLBACKS, keyed by the same path the admin list edits).
export function generateMetadata(): Promise<Metadata> {
    return generatePlatformRouteMetadata("/cookies");
}

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
        <div className="budstacks-theme min-h-screen">
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
                            Last updated: April 25, 2026
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
                            You can change your cookie choices at any time using the button below, or
                            via the "Cookie preferences" link in the site footer. You can also control
                            and delete cookies through your browser settings — note that disabling
                            essential cookies may affect site functionality.
                        </p>
                        <div className="mb-6">
                            <CookiePreferencesLink className="inline-flex items-center gap-2 rounded-xl bg-bs-green-500 px-4 py-2.5 text-sm font-medium text-bs-bg-0 transition hover:bg-bs-green-400 shadow-[0_8px_24px_-8px_rgba(82,217,122,0.5)]">
                                Manage cookie preferences
                            </CookiePreferencesLink>
                        </div>
                        <div className="rounded-2xl bg-bs-bg-2 border border-bs-border p-5">
                            <p className="text-sm text-bs-fg-2">
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
