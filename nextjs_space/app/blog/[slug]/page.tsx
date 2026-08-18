import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, ArrowLeft } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";
import { JsonLd } from "@/components/seo/json-ld";
import { formatPostDate } from "@/lib/platform/post-date";
import type { PlatformPostSummary } from "@/lib/platform/posts";
import {
  loadPublishedPlatformPost,
  loadRelatedPlatformPosts,
} from "@/lib/platform/published-posts";
import { sanitizePostHtml } from "@/lib/security/post-sanitize";
import { BLOG_INDEX_PATH, blogPostPath } from "@/lib/seo/blog-paths";
import { buildPlatformArticleJsonLd } from "@/lib/seo/platform-article-json-ld";
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
 *
 * US-012 deleted the six posts this file used to hardcode, and lib/blog/posts.ts
 * (two more) with them. Concatenating the two was how this page resolved eight
 * slugs while the index advertised six — the drift the deletion ends. All eight
 * are rows now, seeded by 20260816000000_seed_editorial_platform_posts and
 * 20260816010000_seed_sample_platform_posts with the slugs character-for-
 * character as shipped, so every already-indexed /blog/<slug> still resolves.
 */
export const dynamic = "force-dynamic";

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

    // US-018 — Organization, Article and BreadcrumbList, built from the SAME row
    // the body renders and the SAME cascades `generateMetadata` fed the tags
    // above. Nothing here can block the page: the builder is pure and total, and
    // <JsonLd> renders no element for an empty array.
    const jsonLdNodes = buildPlatformArticleJsonLd({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        authorName: post.authorName,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        seo: post.seo,
    });

    return (
        <div className="budstacks-theme min-h-screen">
            <JsonLd nodes={jsonLdNodes} />
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
