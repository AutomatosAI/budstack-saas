import Link from "next/link";
import { cache } from "react";
import { format } from "date-fns";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import sanitizeHtml from "sanitize-html";
import type { posts, users } from "@prisma/client";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { JsonLd } from "@/components/seo/json-ld";
import { buildArticleJsonLd } from "@/lib/seo/article-json-ld";
import {
  buildBreadcrumbJsonLd,
  wirePostBreadcrumbTrail,
} from "@/lib/seo/breadcrumb-json-ld";
import { entityImageAlt } from "@/lib/seo/entity-seo";
import type { JsonLdNode } from "@/lib/seo/json-ld";
import {
  POST_NOT_FOUND_TITLE,
  buildPostMetadata,
} from "@/lib/seo/post-metadata";
import { STORE_NOT_FOUND_TITLE } from "@/lib/seo/store-metadata";
import { tenantLogoRef } from "@/lib/seo/tenant-logo";

interface ArticlePageProps {
  params: {
    slug: string;
    postSlug: string;
  };
}

/**
 * The row shape both consumers below read. Stated explicitly because the
 * `prisma` export in lib/db.ts is any-widened by its build-time mock Proxy, so
 * nothing flows out of the query — and through a generic
 * (`runWithTenantContextAsync<T>`) `any` collapses the inferred T to `{}`.
 */
type WirePost = posts & { users: users | null };

/**
 * The article this URL names, or null — ONE query, shared by `generateMetadata`
 * and the page body through React `cache()`. Both used to run their own copy of
 * it, so every article render made two identical round trips.
 *
 * `findFirst` with flat fields, NOT `findUnique` on the `slug_tenantId` compound
 * key: `posts` is tenant-scoped in lib/db.ts, and the scope extension rewrites
 * findUnique→findFirst while injecting the bound tenantId — findFirst rejects a
 * compound key and would throw PrismaClientValidationError (the same trap
 * documented at app/api/tenant-admin/posts/route.ts:56-59).
 *
 * `published` is part of the query rather than a check on the result, so an
 * unpublished draft's title can no longer leak into the 404 page's <title> —
 * metadata resolves before the page body reaches its notFound().
 *
 * The context binding is what the layout's `runWithTenantContextAsync` does for
 * the page body, and `generateMetadata` resolves outside that scope: without it
 * the $extends layer sees an UNBOUND context on a tenant-scoped model, warns on
 * `security.tenant_context_missing` and would throw under
 * TENANT_CONTEXT_STRICT — inside metadata, where a throw is a blank page. The
 * explicit tenantId in the `where` is what makes the query correct; this is what
 * makes it legal (same pattern as app/tenant-admin/emails/campaigns/[id]/page.tsx:56).
 */
const loadPublishedPost = cache(
  async (tenantId: string, postSlug: string): Promise<WirePost | null> =>
    runWithTenantContextAsync<WirePost | null>(tenantId, () =>
      prisma.posts.findFirst({
        where: { tenantId, slug: postSlug, published: true },
        include: { users: true },
      }),
    ),
);

/** SEO US-003 — posts.seo, the column the SEO Manager has always written. */
export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { title: STORE_NOT_FOUND_TITLE };

  const post = await loadPublishedPost(tenant.id, params.postSlug);
  if (!post) return { title: POST_NOT_FOUND_TITLE };

  return buildPostMetadata({
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    createdAt: post.createdAt,
    seo: post.seo,
    authorName: post.users?.name,
  });
}

/**
 * SEO US-016 — the Article and its breadcrumb trail, built from the SAME post
 * the body renders.
 *
 * The logo comes off `getTenantWithTemplate`, which the store layout already
 * fetches through the same React `cache()`, so the publisher node costs no extra
 * query. Nothing here can block the page: both builders return [] for a Basic
 * tenant, and `<JsonLd>` renders nothing for [].
 */
async function articleJsonLdNodes(
  tenant: NonNullable<Awaited<ReturnType<typeof getCurrentTenant>>>,
  post: WirePost,
): Promise<readonly JsonLdNode[]> {
  const tenantForSeo = await getTenantWithTemplate(tenant.id);

  const identity = {
    tenantId: tenant.id,
    plan: tenant.plan,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
  };

  return [
    ...buildArticleJsonLd({
      ...identity,
      businessName: tenant.businessName,
      logoRef: tenantForSeo ? tenantLogoRef(tenantForSeo) : null,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      seo: post.seo,
      authorName: post.users?.name,
    }),
    ...buildBreadcrumbJsonLd(
      identity,
      wirePostBreadcrumbTrail(post.title, post.slug),
    ),
  ];
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { postSlug } = params;

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const post = await loadPublishedPost(tenant.id, postSlug);

  if (!post) notFound();

  const jsonLdNodes = await articleJsonLdNodes(tenant, post);

  // Server-side HTML sanitization for XSS protection
  // Using sanitize-html (Node.js compatible) instead of isomorphic-dompurify (ESM issues)
  const cleanContent = sanitizeHtml(post.content || "", {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'iframe', 'video']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id'], // Removed 'style' from global allowlist
      img: ['src', 'alt', 'title', 'width', 'height'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
      video: ['src', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
    // Controlled whitelist of safe CSS properties
    allowedStyles: {
      '*': {
        // Typography
        'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        'font-size': [/^\d+(?:px|em|rem|%)$/],
        'font-weight': [/^(?:normal|bold|[1-9]00)$/],
        // Layout
        'width': [/^\d+(?:px|em|rem|%)$/],
        'height': [/^\d+(?:px|em|rem|%)$/],
        'margin': [/^\d+(?:px|em|rem|%)(?: \d+(?:px|em|rem|%))*$/],
        'padding': [/^\d+(?:px|em|rem|%)(?: \d+(?:px|em|rem|%))*$/],
        // Background
        'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
      }
    }
  });

  return (
    <div className="min-h-screen bg-background text-foreground pt-36 pb-12">
      <JsonLd nodes={jsonLdNodes} />
      <div className="container px-4 mx-auto max-w-4xl">
        <Link
          href={`/store/${tenant.subdomain}/the-wire`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to The Wire
        </Link>

        <article className="prose prose-lg mx-auto dark:prose-invert">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 not-prose">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(post.createdAt), "MMMM d, yyyy")}
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {post.users?.name || "Admin"}
            </div>
          </div>

          {post.coverImage && (
            <div className="aspect-video relative rounded-lg overflow-hidden mb-8 not-prose">
              <img
                src={post.coverImage}
                // US-009 — the authored alt, falling back to the title (the
                // string this used to hard-code, which describes the article
                // rather than the picture).
                alt={entityImageAlt(post.seo, post.title)}
                className="object-cover w-full h-full"
              />
            </div>
          )}

          {/* Render HTML Content */}
          <div dangerouslySetInnerHTML={{ __html: cleanContent }} />
        </article>
      </div>
    </div>
  );
}
