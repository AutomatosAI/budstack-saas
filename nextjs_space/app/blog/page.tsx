import Link from "next/link";
import { FileText } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";

// Sample blog posts - in a real app these would come from a CMS or database
const blogPosts = [
    {
        id: 1,
        slug: "getting-started-with-medical-cannabis-franchise",
        title: "Getting Started with Your Medical Cannabis Franchise",
        date: "Jan 10, 2026",
        excerpt:
            "A comprehensive guide to launching your dispensary franchise with Popcorn Media infrastructure.",
        image:
            "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=500&fit=crop",
    },
    {
        id: 2,
        slug: "understanding-dr-green-api-integration",
        title: "Understanding Dr. Green API Integration",
        date: "Jan 5, 2026",
        excerpt:
            "How to leverage the Dr. Green API for seamless product catalog and order management.",
        image:
            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
    },
    {
        id: 3,
        slug: "blockchain-traceability-compliance",
        title: "Blockchain Traceability & Compliance",
        date: "Dec 28, 2025",
        excerpt:
            "Ensuring regulatory compliance with integrated blockchain tracking for your dispensary.",
        image:
            "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=500&fit=crop",
    },
    {
        id: 4,
        slug: "scaling-multi-tenant-operations",
        title: "Scaling Multi-Tenant Operations",
        date: "Dec 20, 2025",
        excerpt:
            "Best practices for managing multiple storefronts with isolated data and custom branding.",
        image:
            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
    },
    {
        id: 5,
        slug: "customer-management-best-practices",
        title: "Customer Management Best Practices",
        date: "Dec 15, 2025",
        excerpt:
            "Building lasting patient relationships through effective CRM and consultation tracking.",
        image:
            "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=800&h=500&fit=crop",
    },
    {
        id: 6,
        slug: "maximizing-revenue-analytics",
        title: "Maximizing Revenue with Analytics",
        date: "Dec 10, 2025",
        excerpt:
            "Using data-driven insights to optimize your dispensary's performance and growth.",
        image:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop",
    },
];

export default function BlogPage() {
    return (
        <div className="min-h-screen bg-background">
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
                        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                            Resources for franchise owners
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
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
                                {/* Image */}
                                <div className="aspect-[16/10] overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        {post.date}
                                    </p>
                                    <h2 className="font-display text-xl font-bold text-foreground transition-colors group-hover:text-accent">
                                        {post.title}
                                    </h2>
                                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
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
