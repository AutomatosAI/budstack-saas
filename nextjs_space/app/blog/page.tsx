import Link from "next/link";
import { FileText } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";
import { formatPostDate } from "@/lib/platform/post-date";
import { loadPublishedPlatformPosts } from "@/lib/platform/published-posts";
import type { PlatformPostSummary } from "@/lib/platform/posts";
import { blogPostPath } from "@/lib/seo/blog-paths";

/**
 * US-008 — the index lists published `platform_posts`, newest first. Nothing on
 * this page is authored in code any more: a super-admin publishes at
 * /super-admin/the-wire and the article is live without a deploy.
 *
 * US-012 removed the last copy authored in code. This file used to hardcode six
 * posts; the detail page hardcoded the same six and concatenated two more from
 * lib/blog/posts.ts, so the index advertised six while eight URLs resolved. All
 * eight are rows now — 20260816000000_seed_editorial_platform_posts and
 * 20260816010000_seed_sample_platform_posts put them there with the slugs
 * unchanged — so the table is the single source and that drift cannot recur.
 */

/**
 * The build-time Prisma client is a mock that answers every query with `[]`
 * (DATABASE_URL is a dummy at build). Without this, an empty blog would be
 * baked into the static output and no publish would ever appear — the same
 * reason app/sitemap.ts sets it.
 */
export const dynamic = "force-dynamic";

export default async function BlogPage() {
    // Throws rather than returning [] when the database cannot answer, so an
    // outage does not render as "we have never published anything".
    const posts: PlatformPostSummary[] = await loadPublishedPlatformPosts();

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

                    {/* Blog grid — a successful query with no rows lands here,
                        and says so. A query that FAILED never reaches this
                        point; loadPublishedPlatformPosts throws. */}
                    {posts.length === 0 ? (
                        <div className="card-floating mx-auto max-w-xl p-12 text-center">
                            <FileText
                                className="mx-auto mb-4 h-8 w-8 text-bs-fg-3"
                                aria-hidden="true"
                            />
                            <h2 className="font-bs-serif text-xl font-medium text-bs-fg-0">
                                Nothing published yet
                            </h2>
                            <p className="mt-2 text-sm text-bs-fg-2">
                                The first posts are on their way — check back shortly.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-8 md:grid-cols-2">
                            {posts.map((post) => {
                                const date = formatPostDate(post.publishedAt);

                                return (
                                    <Link
                                        key={post.id}
                                        href={blogPostPath(post.slug)}
                                        className="card-floating group overflow-hidden"
                                    >
                                        {/* Image — gradient backdrop shows through if the photo
                                            fails to load, and is the whole backdrop when a post
                                            has no cover at all */}
                                        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-bs-green-500/25 via-bs-bg-1 to-bs-gold-400/15">
                                            {post.coverImage ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img
                                                    src={post.coverImage}
                                                    alt={post.coverImageAlt || post.title}
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer"
                                                    className="h-full w-full object-cover opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
                                                />
                                            ) : null}
                                            {/* Top-down dark wash for legibility against varied photos */}
                                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bs-bg-0/60 via-transparent to-transparent" />
                                        </div>

                                        {/* Content */}
                                        <div className="p-6">
                                            {date ? (
                                                <p className="mb-2 font-bs-mono text-[11px] uppercase tracking-[0.14em] text-bs-fg-3">
                                                    {date}
                                                </p>
                                            ) : null}
                                            <h2 className="font-bs-serif text-xl font-medium text-bs-fg-0 transition-colors group-hover:text-bs-green-300">
                                                {post.title}
                                            </h2>
                                            {post.excerpt ? (
                                                <p className="mt-2 line-clamp-2 text-sm text-bs-fg-2">
                                                    {post.excerpt}
                                                </p>
                                            ) : null}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
