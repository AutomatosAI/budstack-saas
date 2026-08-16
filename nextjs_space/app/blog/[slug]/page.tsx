import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, ArrowLeft } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";
import { formatPostDate } from "@/lib/platform/post-date";
import type { PlatformPostSummary } from "@/lib/platform/posts";
import {
  loadPublishedPlatformPost,
  loadRelatedPlatformPosts,
} from "@/lib/platform/published-posts";
import { sanitizePostHtml } from "@/lib/security/post-sanitize";
import { BLOG_INDEX_PATH, blogPostPath } from "@/lib/seo/blog-paths";
import {
  PLATFORM_POST_NOT_FOUND_TITLE,
  buildPlatformPostMetadata,
} from "@/lib/seo/platform-post-metadata";

/**
 * US-009 — one article, served from `platform_posts`, carrying its OWN title,
 * description, canonical and og:image. Until now this page exported no metadata
 * at all, so all eight posts shared the root layout's title.
 *
 * The build-time Prisma client is a mock that answers every query with `[]`
 * (DATABASE_URL is a dummy at build), and `generateStaticParams` used to
 * pre-render one route per inline post. Both are gone: the route list now lives
 * in the database, so the page renders per request instead.
 */
export const dynamic = "force-dynamic";

/**
 * NOT RENDERED, and not deleted either — this array is the ONLY copy of the six
 * sample posts' article bodies, and US-011's migration is written from it.
 * US-010 does the same for `lib/blog/posts.ts`. US-012 deletes both, and only
 * once the content is in the table.
 */
const samplePosts = [
    {
        id: 1,
        slug: "getting-started-with-medical-cannabis-franchise",
        title: "Getting Started with Your Medical Cannabis Franchise",
        date: "Jan 10, 2026",
        author: "Jordan Miller",
        role: "Head of Operations, BudStacks",
        excerpt:
            "A comprehensive guide to launching your dispensary franchise with BudStacks infrastructure.",
        image:
            "/images/blog/post-01-franchise.svg",
        content: `
      <p>Launching a medical cannabis franchise has never been easier. With BudStacks's proprietary infrastructure, you can go from application to live store in under 10 minutes.</p>
      
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
      
      <p>Ready to get started? Apply for your franchise today and join the growing network of medical cannabis dispensaries powered by BudStacks.</p>
    `,
        category: "Getting Started",
    },
    {
        id: 2,
        slug: "understanding-dr-green-api-integration",
        title: "Understanding Dr. Green API Integration",
        date: "Jan 5, 2026",
        author: "Stefan Klein",
        role: "Technical Lead, BudStacks",
        excerpt:
            "How to leverage the Dr. Green API for seamless product catalog and order management.",
        image:
            "/images/blog/post-02-api.svg",
        content: `
      <p>The Dr. Green API is at the heart of every BudStacks franchise. This integration provides real-time product synchronization, automated inventory management, and seamless order fulfillment.</p>
      
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
        role: "Compliance Officer, BudStacks",
        excerpt:
            "Ensuring regulatory compliance with integrated blockchain tracking for your dispensary.",
        image:
            "/images/blog/post-03-blockchain.svg",
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
        role: "Solutions Architect, BudStacks",
        excerpt:
            "Best practices for managing multiple storefronts with isolated data and custom branding.",
        image:
            "/images/blog/post-04-scale.svg",
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
        role: "Customer Success, BudStacks",
        excerpt:
            "Building lasting patient relationships through effective CRM and consultation tracking.",
        image:
            "/images/blog/post-05-customers.svg",
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
        role: "Technical Lead, BudStacks",
        excerpt:
            "Using data-driven insights to optimize your dispensary's performance and growth.",
        image:
            "/images/blog/post-06-analytics.svg",
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

interface PageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Per-post metadata. `loadPublishedPlatformPost` is React-`cache()`d and is the
 * SAME call the page body makes below, so this costs no extra query — and the
 * title cannot describe a different revision from the body.
 *
 * A slug that resolves to nothing returns the not-found title rather than
 * building one from a post that is not there. What a visitor SEES on that 404 is
 * the not-found boundary's own metadata — verified live: Next renders the
 * boundary's title, not this one — so the value here is what it refuses to
 * emit. `published: true` is inside the query, so a draft is indistinguishable
 * from a slug that never existed and neither can put its title in a tag.
 *
 * A query that FAILED never reaches here: the loader throws, which is a 500.
 */
export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = await loadPublishedPlatformPost(slug);
    if (!post) return { title: PLATFORM_POST_NOT_FOUND_TITLE };

    return buildPlatformPostMetadata({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        authorName: post.authorName,
        publishedAt: post.publishedAt,
        seo: post.seo,
    });
}

export default async function BlogPostPage({ params }: PageProps) {
    const { slug } = await params;

    // `published: true` is in the query, so a draft is indistinguishable from a
    // slug that never existed — both 404 rather than leaking a title.
    const post = await loadPublishedPlatformPost(slug);

    if (!post) {
        notFound();
    }

    // Degrades to [] if its own query fails; the article is what the visitor
    // came for and must not be taken down over the strip at the bottom.
    const relatedPosts: PlatformPostSummary[] =
        await loadRelatedPlatformPosts(post.slug);

    const publishedDate = formatPostDate(post.publishedAt);

    // Sanitised on the way OUT as well as on the way in (the write API already
    // applies the same policy): a row written before a rules change still
    // renders under the current one.
    const cleanContent = sanitizePostHtml(post.content);

    return (
        <div className="budstacks-theme min-h-screen">
            <Navbar />

            <main className="px-4 py-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    {/* Back link */}
                    <Link
                        href={BLOG_INDEX_PATH}
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

                            {/* Byline — the role is optional in the table, so the
                                dash only appears when there is something after it */}
                            <p className="text-muted-foreground mb-2">
                                {post.authorRole
                                    ? `${post.authorName} – ${post.authorRole}`
                                    : post.authorName}
                            </p>

                            {/* Date */}
                            {publishedDate ? (
                                <p className="text-sm font-medium text-accent uppercase tracking-wide">
                                    {publishedDate}
                                </p>
                            ) : null}
                        </header>

                        {/* Featured image with curved depth. A cover is optional
                            — neither the editor nor the migration makes one
                            mandatory — and an <img> with an empty src refetches
                            the page itself, so the block is dropped entirely
                            rather than rendered empty. */}
                        {post.coverImage ? (
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
                                        src={post.coverImage}
                                        // The authored alt describes the picture;
                                        // the title describes the article, and is
                                        // the fallback rather than the answer.
                                        alt={post.coverImageAlt || post.title}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        ) : null}

                        {/* Article content — .bs-article supplies the typography
                            the inert prose-* classes never did (globals.css). */}
                        <div
                            className="bs-article"
                            dangerouslySetInnerHTML={{ __html: cleanContent }}
                        />
                    </article>
                </div>

                {/* More posts section. Hidden entirely when this is the only
                    published article, rather than showing a heading over
                    nothing — which is what the inline arrays could never do. */}
                {relatedPosts.length > 0 ? (
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
                        {relatedPosts.map((relatedPost) => {
                            const relatedDate = formatPostDate(
                                relatedPost.publishedAt,
                            );

                            return (
                            <Link
                                key={relatedPost.id}
                                href={blogPostPath(relatedPost.slug)}
                                className="group"
                            >
                                {/* Image with curved depth. The gradient is the
                                    whole backdrop for a post with no cover, so
                                    the card keeps its shape either way — the
                                    same treatment the index gives it. */}
                                <div
                                    className="aspect-[16/10] overflow-hidden rounded-[2rem] mb-4 bg-gradient-to-br from-bs-green-500/25 via-bs-bg-1 to-bs-gold-400/15"
                                    style={{
                                        boxShadow: `
                      0 20px 40px -16px rgba(0, 0, 0, 0.10),
                      0 8px 16px -8px rgba(0, 0, 0, 0.08)
                    `,
                                    }}
                                >
                                    {relatedPost.coverImage ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={relatedPost.coverImage}
                                            alt={
                                                relatedPost.coverImageAlt ||
                                                relatedPost.title
                                            }
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                    ) : null}
                                </div>

                                {/* Date */}
                                {relatedDate ? (
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                                        {relatedDate}
                                    </p>
                                ) : null}

                                {/* Title */}
                                <h3 className="font-display text-lg font-bold text-foreground transition-colors group-hover:text-accent">
                                    {relatedPost.title}
                                </h3>
                            </Link>
                            );
                        })}
                    </div>
                </div>
                ) : null}
            </main>

            <Footer />
        </div>
    );
}
