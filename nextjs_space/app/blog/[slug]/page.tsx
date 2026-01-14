import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowLeft } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { Navbar, Footer } from "@/components/landing";

// Sample blog posts data - in production this would come from a CMS/database
const blogPosts = [
    {
        id: 1,
        slug: "getting-started-with-medical-cannabis-franchise",
        title: "Getting Started with Your Medical Cannabis Franchise",
        date: "Jan 10, 2026",
        author: "Jordan Miller",
        role: "Head of Operations, Popcorn Media",
        excerpt:
            "A comprehensive guide to launching your dispensary franchise with Popcorn Media infrastructure.",
        image:
            "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=700&fit=crop",
        content: `
      <p>Launching a medical cannabis franchise has never been easier. With Popcorn Media's proprietary infrastructure, you can go from application to live store in under 10 minutes.</p>
      
      <h2>Understanding the Franchise Model</h2>
      <p>Our franchise model is designed to give you complete operational flexibility while providing enterprise-grade infrastructure. Whether you choose fully managed, semi-managed, or independent operation, you get access to the same powerful tools.</p>
      
      <h2>Step 1: Apply for Your Franchise</h2>
      <p>The application process is straightforward. You'll need your NFT token ID for verification, basic business information, and your preferred operating country. Our team reviews applications within 24-48 hours.</p>
      
      <h2>Step 2: Customize Your Store</h2>
      <p>Once approved, you'll have access to our template system. Choose from professionally designed templates, customize colors and branding, upload your logo, and configure your domain.</p>
      
      <h2>Step 3: Launch and Scale</h2>
      <p>Your store goes live instantly. The Dr. Green API integration ensures your product catalog is always up to date, and our analytics dashboard gives you real-time insights into your business performance.</p>
      
      <h2>What's Included</h2>
      <ul>
        <li>White-label storefront with custom branding</li>
        <li>Admin dashboard with full analytics</li>
        <li>Dr. Green API integration for products</li>
        <li>Customer management and CRM</li>
        <li>Order tracking and fulfillment</li>
        <li>Blockchain traceability for compliance</li>
      </ul>
      
      <p>Ready to get started? Apply for your franchise today and join the growing network of medical cannabis dispensaries powered by Popcorn Media.</p>
    `,
        category: "Getting Started",
    },
    {
        id: 2,
        slug: "understanding-dr-green-api-integration",
        title: "Understanding Dr. Green API Integration",
        date: "Jan 5, 2026",
        author: "Stefan Klein",
        role: "Technical Lead, Popcorn Media",
        excerpt:
            "How to leverage the Dr. Green API for seamless product catalog and order management.",
        image:
            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=700&fit=crop",
        content: `
      <p>The Dr. Green API is at the heart of every Popcorn Media franchise. This integration provides real-time product synchronization, automated inventory management, and seamless order fulfillment.</p>
      
      <h2>Real-Time Product Sync</h2>
      <p>Your product catalog is automatically synchronized with Dr. Green's database. When new products are added or prices change, your store updates instantly. No manual updates required.</p>
      
      <h2>Inventory Management</h2>
      <p>Stock levels are tracked in real-time. When a product runs low or goes out of stock, your store reflects this immediately. This prevents overselling and ensures customer satisfaction.</p>
      
      <h2>Order Fulfillment</h2>
      <p>When customers place orders, they're automatically routed to the fulfillment center. You can track order status from your admin dashboard, from processing to delivery.</p>
      
      <h2>API Health Monitoring</h2>
      <p>Our dashboard includes API health monitoring. You can see uptime statistics, response times, and any issues at a glance. Our current uptime is 99.9%.</p>
    `,
        category: "Technical",
    },
    {
        id: 3,
        slug: "blockchain-traceability-compliance",
        title: "Blockchain Traceability & Compliance",
        date: "Dec 28, 2025",
        author: "Emma Williams",
        role: "Compliance Officer, Popcorn Media",
        excerpt:
            "Ensuring regulatory compliance with integrated blockchain tracking for your dispensary.",
        image:
            "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&h=700&fit=crop",
        content: `
      <p>Regulatory compliance is critical in the medical cannabis industry. Our blockchain traceability system ensures complete transparency and audit readiness.</p>
      
      <h2>Why Blockchain?</h2>
      <p>Blockchain provides an immutable record of every transaction. From seed to sale, every step is recorded and verifiable. This meets the strictest regulatory requirements across all operating countries.</p>
      
      <h2>Audit Logging</h2>
      <p>Every action in your admin dashboard is logged. User access, order modifications, inventory changes - everything is recorded with timestamps and user attribution.</p>
      
      <h2>Compliance Reporting</h2>
      <p>Generate compliance reports with one click. Our system aggregates all required data and formats it according to your jurisdiction's requirements.</p>
    `,
        category: "Compliance",
    },
    {
        id: 4,
        slug: "scaling-multi-tenant-operations",
        title: "Scaling Multi-Tenant Operations",
        date: "Dec 20, 2025",
        author: "João Mendes",
        role: "Solutions Architect, Popcorn Media",
        excerpt:
            "Best practices for managing multiple storefronts with isolated data and custom branding.",
        image:
            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=700&fit=crop",
        content: `
      <p>As your franchise grows, you may want to operate multiple storefronts. Our multi-tenant architecture makes this seamless.</p>
      
      <h2>Data Isolation</h2>
      <p>Each storefront has completely isolated data. Customer information, orders, and analytics are kept separate. This ensures privacy and simplifies management.</p>
      
      <h2>Centralized Dashboard</h2>
      <p>While data is isolated, you can view all storefronts from a single dashboard. Compare performance, track orders, and manage inventory across locations.</p>
      
      <h2>Custom Branding Per Location</h2>
      <p>Each storefront can have its own branding. Different colors, logos, and content - all managed independently while sharing the same infrastructure.</p>
    `,
        category: "Operations",
    },
    {
        id: 5,
        slug: "customer-management-best-practices",
        title: "Customer Management Best Practices",
        date: "Dec 15, 2025",
        author: "Maria Santos",
        role: "Customer Success, Popcorn Media",
        excerpt:
            "Building lasting patient relationships through effective CRM and consultation tracking.",
        image:
            "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=1200&h=700&fit=crop",
        content: `
      <p>Strong customer relationships are the foundation of a successful dispensary. Our CRM tools help you manage every interaction.</p>
      
      <h2>Patient Onboarding</h2>
      <p>Streamline the patient onboarding process with our digital forms. Collect necessary documentation, verify KYC requirements, and get patients ready to order.</p>
      
      <h2>Consultation Tracking</h2>
      <p>Track every consultation, noting patient preferences, medical requirements, and recommendations. This information is securely stored and easily accessible.</p>
      
      <h2>Order History</h2>
      <p>View complete order history for each customer. Identify purchasing patterns, recommend products, and provide personalized service.</p>
    `,
        category: "Customer Success",
    },
    {
        id: 6,
        slug: "maximizing-revenue-analytics",
        title: "Maximizing Revenue with Analytics",
        date: "Dec 10, 2025",
        author: "Stefan Klein",
        role: "Technical Lead, Popcorn Media",
        excerpt:
            "Using data-driven insights to optimize your dispensary's performance and growth.",
        image:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=700&fit=crop",
        content: `
      <p>Data-driven decision making is key to maximizing your dispensary's revenue. Our analytics dashboard provides the insights you need.</p>
      
      <h2>Revenue Tracking</h2>
      <p>Track daily, weekly, and monthly revenue. See trends over time and identify peak selling periods. Compare performance across time periods.</p>
      
      <h2>Product Performance</h2>
      <p>Identify your best-selling products and categories. See which items drive the most revenue and which have the highest margins.</p>
      
      <h2>Customer Insights</h2>
      <p>Understand your customer base. See average order values, purchase frequency, and customer lifetime value. Use this data to optimize your marketing.</p>
    `,
        category: "Analytics",
    },
];

// Get related posts (exclude current post)
function getRelatedPosts(currentSlug: string, limit = 2) {
    return blogPosts
        .filter((post) => post.slug !== currentSlug)
        .slice(0, limit);
}

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
    const { slug } = await params;
    const post = blogPosts.find((p) => p.slug === slug);

    if (!post) {
        notFound();
    }

    const relatedPosts = getRelatedPosts(post.slug);

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <main className="px-4 py-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Back link */}
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Blog
                    </Link>

                    {/* Article header */}
                    <article>
                        <header className="text-center mb-12">
                            {/* Badge */}
                            <div className="mb-6 flex justify-center">
                                <div className="section-badge">
                                    <FileText className="h-4 w-4" />
                                    Blog Article
                                </div>
                            </div>

                            {/* Title */}
                            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl mb-6">
                                {post.title}
                            </h1>

                            {/* Author info */}
                            <p className="text-muted-foreground mb-2">
                                {post.author} – {post.role}
                            </p>

                            {/* Date */}
                            <p className="text-sm font-medium text-accent uppercase tracking-wide">
                                {post.date}
                            </p>
                        </header>

                        {/* Featured image with curved depth */}
                        <div className="mb-12">
                            <div
                                className="aspect-[16/9] overflow-hidden rounded-[2.5rem]"
                                style={{
                                    boxShadow: `
                    0 32px 64px -20px rgba(0, 0, 0, 0.12),
                    0 12px 24px -12px rgba(0, 0, 0, 0.10),
                    0 6px 12px -8px rgba(0, 0, 0, 0.08)
                  `,
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={post.image}
                                    alt={post.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Article content */}
                        <div
                            className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-accent hover:prose-a:text-accent/80 prose-strong:text-foreground prose-ul:text-muted-foreground prose-li:marker:text-accent"
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(post.content),
                            }}
                        />
                    </article>
                </div>

                {/* More posts section */}
                <div className="mx-auto max-w-5xl mt-24 pt-16 border-t border-border">
                    {/* Section header */}
                    <div className="text-center mb-12">
                        <div className="mb-4 flex justify-center">
                            <div className="section-badge">
                                <FileText className="h-4 w-4" />
                                Blog
                            </div>
                        </div>
                        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                            More on franchise operations
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                            Short practical guides and stories on dispensary management and growth.
                        </p>
                    </div>

                    {/* Related posts grid */}
                    <div className="grid gap-8 md:grid-cols-2">
                        {relatedPosts.map((relatedPost) => (
                            <Link
                                key={relatedPost.id}
                                href={`/blog/${relatedPost.slug}`}
                                className="group"
                            >
                                {/* Image with curved depth */}
                                <div
                                    className="aspect-[16/10] overflow-hidden rounded-[2rem] mb-4"
                                    style={{
                                        boxShadow: `
                      0 20px 40px -16px rgba(0, 0, 0, 0.10),
                      0 8px 16px -8px rgba(0, 0, 0, 0.08)
                    `,
                                    }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={relatedPost.image}
                                        alt={relatedPost.title}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                </div>

                                {/* Date */}
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                                    {relatedPost.date}
                                </p>

                                {/* Title */}
                                <h3 className="font-display text-lg font-bold text-foreground transition-colors group-hover:text-accent">
                                    {relatedPost.title}
                                </h3>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

// Generate static params for all blog posts
export function generateStaticParams() {
    return blogPosts.map((post) => ({
        slug: post.slug,
    }));
}
