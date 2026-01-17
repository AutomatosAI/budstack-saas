import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import sanitizeHtml from "sanitize-html";

interface ArticlePageProps {
  params: {
    slug: string;
    postSlug: string;
  };
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug, postSlug } = params;
  const tenant = await prisma.tenants.findUnique({
    where: { subdomain: slug },
  });
  if (!tenant) return { title: "Not Found" };

  const post = await prisma.posts.findUnique({
    where: { slug_tenantId: { slug: postSlug, tenantId: tenant.id } },
  });

  if (!post) return { title: "Not Found" };

  return {
    title: `${post.title} | ${tenant.businessName}`,
    description: post.excerpt,
    openGraph: {
      images: post.coverImage ? [post.coverImage] : [],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug, postSlug } = params;

  const tenant = await prisma.tenants.findUnique({
    where: { subdomain: slug },
  });
  if (!tenant) notFound();

  const post = await prisma.posts.findUnique({
    where: { slug_tenantId: { slug: postSlug, tenantId: tenant.id } },
    include: { users: true },
  });

  if (!post || !post.published) notFound();

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
      <div className="container px-4 mx-auto max-w-4xl">
        <Link
          href={`/store/${slug}/the-wire`}
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
                alt={post.title}
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
