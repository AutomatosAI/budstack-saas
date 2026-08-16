import { Metadata } from 'next';
import { generatePlatformRouteMetadata } from '@/lib/seo/generate-platform-metadata';

// US-015 — read from `platform_seo_settings`, falling back per column to the
// title and description this page used to hardcode (now in
// PLATFORM_ROUTE_FALLBACKS, keyed by the same path the admin list edits).
export function generateMetadata(): Promise<Metadata> {
    return generatePlatformRouteMetadata('/faq');
}

export default function FAQPage() {
    return (
        <div className="container mx-auto px-4 py-16 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8">Frequently Asked Questions</h1>

            <div className="space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-3">What is medical cannabis?</h2>
                    <p className="text-muted-foreground">
                        Medical cannabis refers to cannabis products prescribed by healthcare
                        providers to treat specific medical conditions.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">How do I get a prescription?</h2>
                    <p className="text-muted-foreground">
                        Complete our online consultation with a licensed healthcare provider
                        who will assess your eligibility.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">How long does delivery take?</h2>
                    <p className="text-muted-foreground">
                        Delivery times vary by location but typically range from 3-5 business days.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Is my information secure?</h2>
                    <p className="text-muted-foreground">
                        Yes, we use industry-standard encryption and comply with all data
                        protection regulations.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Can I choose my products?</h2>
                    <p className="text-muted-foreground">
                        Your healthcare provider will recommend products based on your needs,
                        and you can discuss options during your consultation.
                    </p>
                </section>
            </div>
        </div>
    );
}
