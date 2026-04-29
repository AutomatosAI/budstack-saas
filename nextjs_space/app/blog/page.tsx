import Link from "next/link";
import { FileText } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";

// Sample blog posts - in a real app these would come from a CMS or database.
// Images are local SVG placeholders (themed to BudStacks palette) —
// placeholder while the blog widget is being finished.
const blogPosts = [
    {
        id: 1,
        slug: "getting-started-with-medical-cannabis-franchise",
        title: "Getting Started with Your Medical Cannabis Franchise",
        date: "Jan 10, 2026",
        excerpt:
            "A comprehensive guide to launching your dispensary franchise with BudStacks infrastructure.",
        image: "/images/blog/post-01-franchise.svg",
    },
    {
        id: 2,
        slug: "understanding-dr-green-api-integration",
        title: "Understanding Dr. Green API Integration",
        date: "Jan 5, 2026",
        excerpt:
            "How to leverage the Dr. Green API for seamless product catalog and order management.",
        image: "/images/blog/post-02-api.svg",
    },
    {
        id: 3,
        slug: "blockchain-traceability-compliance",
        title: "Blockchain Traceability & Compliance",
        date: "Dec 28, 2025",
        excerpt:
            "Ensuring regulatory compliance with integrated blockchain tracking for your dispensary.",
        image: "/images/blog/post-03-blockchain.svg",
    },
    {
        id: 4,
        slug: "scaling-multi-tenant-operations",
        title: "Scaling Multi-Tenant Operations",
        date: "Dec 20, 2025",
        excerpt:
            "Best practices for managing multiple storefronts with isolated data and custom branding.",
        image: "/images/blog/post-04-scale.svg",
    },
    {
        id: 5,
        slug: "customer-management-best-practices",
        title: "Customer Management Best Practices",
        date: "Dec 15, 2025",
        excerpt:
            "Building lasting patient relationships through effective CRM and consultation tracking.",
        image: "/images/blog/post-05-customers.svg",
    },
    {
        id: 6,
        slug: "maximizing-revenue-analytics",
        title: "Maximizing Revenue with Analytics",
        date: "Dec 10, 2025",
        excerpt:
            "Using data-driven insights to optimize your dispensary's performance and growth.",
        image: "/images/blog/post-06-analytics.svg",
    },
];

export default function BlogPage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />

            <main className="px-4 py-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    {/* Header */}
                    <div className="mb-16 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <FileText className="h-4 w-4" />
                                Blog
                            </div>
                        </div>
                        <h1 className="font-bs-serif text-3xl font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-4xl md:text-5xl">
                            Resources for franchise owners
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-bs-fg-1">
                            Hands-on posts that help you launch, manage and scale your
                            dispensary.
                        </p>
                    </div>

                    {/* Blog grid */}
                    <div className="grid gap-8 md:grid-cols-2">
                        {blogPosts.map((post) => (
                            <Link
                                key={post.id}
                                href={`/blog/${post.slug}`}
                                className="card-floating group overflow-hidden"
                            >
                                {/* Image — gradient backdrop shows through if photo fails to load */}
                                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-bs-green-500/25 via-bs-bg-1 to-bs-gold-400/15">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        className="h-full w-full object-cover opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
                                    />
                                    {/* Top-down dark wash for legibility against varied photos */}
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bs-bg-0/60 via-transparent to-transparent" />
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <p className="mb-2 font-bs-mono text-[11px] uppercase tracking-[0.14em] text-bs-fg-3">
                                        {post.date}
                                    </p>
                                    <h2 className="font-bs-serif text-xl font-medium text-bs-fg-0 transition-colors group-hover:text-bs-green-300">
                                        {post.title}
                                    </h2>
                                    <p className="mt-2 line-clamp-2 text-sm text-bs-fg-2">
                                        {post.excerpt}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
