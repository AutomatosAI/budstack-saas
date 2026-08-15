import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Regulatory Information',
    description: 'Regulatory compliance and legal information',
};

export default function RegulatoryPage() {
    return (
        <div className="container mx-auto px-4 py-16 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8">Regulatory Information</h1>

            {/* No article class here, deliberately. Unlike the other legal
                pages this one does NOT wrap itself in .budstacks-theme, so it
                renders on the light :root palette — .bs-article's light body
                colour would be grey-on-white. Every heading and paragraph below
                already carries explicit utility classes, so the `prose-*` chain
                that used to sit here was styling nothing it needed. */}
            <div>
                <p className="text-lg text-muted-foreground mb-6">
                    Last updated: {new Date().toLocaleDateString()}
                </p>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Medical Cannabis Regulations</h2>
                    <p>
                        We operate in full compliance with local and national regulations
                        governing medical cannabis distribution and use.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Patient Requirements</h2>
                    <p>
                        All patients must have a valid prescription from a licensed healthcare
                        provider to access medical cannabis products.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Quality Standards</h2>
                    <p>
                        Our products meet strict quality and safety standards as required
                        by regulatory authorities.
                    </p>
                </section>
            </div>
        </div>
    );
}
