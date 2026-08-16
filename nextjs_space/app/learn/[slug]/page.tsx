import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/storage/s3";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Play, FileText, Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { platformCanonical } from "@/lib/seo/platform-url";
import { Navbar, Footer } from "@/components/landing";
import { LearnChatbot } from "../learn-chatbot";
import { MarkdownContent } from "./markdown-content";

// PRD-220 AC-C2: no dynamic API calls here, so without a revalidate window
// Next.js would statically cache the signed doc-download URL baked in at
// render time — and getFileUrl's signatures expire after 3600s (see
// lib/storage/s3.ts). Revalidate well under that so cached HTML re-signs
// before the URL goes stale.
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const resource = await prisma.learning_resources.findUnique({
    where: { slug: params.slug, isPublished: true },
  });
  // No canonical for a slug that resolves to nothing: this branch renders a
  // 404, and declaring one would hand a crawler the address of a page that
  // does not exist.
  if (!resource) return { title: "Not Found | BudStacks" };
  return {
    title: `${resource.title} | BudStacks Learning Center`,
    description: resource.description || undefined,
    // US-017 — the last public content route on budstacks.io with no canonical.
    // `/learn/{slug}` is listed in app/sitemap.ts and linked from the Learning
    // Center, so every campaign and referral URL that lands on it —
    // `?utm_source=…`, `?ref=…` — answers 200 on the same article and competes
    // with it. The clean path is declared from the resolved row's slug rather
    // than `params.slug`, so a request that reached the row by some other
    // casing or encoding still points at the one address the sitemap lists.
    alternates: { canonical: platformCanonical(`/learn/${resource.slug}`) },
  };
}

function extractVideoEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

export default async function LearnArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const resource = await prisma.learning_resources.findUnique({
    where: { slug: params.slug, isPublished: true },
  });

  if (!resource) notFound();

  // Sign doc URL if it's an S3 key
  let docDownloadUrl: string | null = null;
  if (resource.docUrl) {
    if (resource.docUrl.startsWith("http")) {
      docDownloadUrl = resource.docUrl;
    } else {
      try {
        docDownloadUrl = await getFileUrl(resource.docUrl);
      } catch {
        docDownloadUrl = null;
      }
    }
  }

  // Video embed
  const embedUrl = resource.videoUrl
    ? extractVideoEmbedUrl(resource.videoUrl)
    : null;

  // Automatos widget
  const platformSettings = await prisma.platform_settings.findUnique({
    where: { id: "platform" },
    select: { automatosApiKey: true, automatosAgentId: true },
  });

  return (
    <div className="budstacks-theme min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Back link */}
        <Link
          href="/learn"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Learning Center
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="capitalize">
              {resource.type}
            </Badge>
            <Badge variant="outline">{resource.category}</Badge>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {resource.title}
          </h1>
          {resource.description && (
            <p className="mt-3 text-lg text-muted-foreground">
              {resource.description}
            </p>
          )}
          {resource.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-4">
              {resource.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-bs-card-2 text-bs-fg-muted border border-bs-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Video Embed */}
        {embedUrl && (
          <div className="aspect-video rounded-xl overflow-hidden bg-black mb-8">
            <iframe
              src={embedUrl}
              title={resource.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Non-embeddable video link */}
        {resource.videoUrl && !embedUrl && (
          <a
            href={resource.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-bs-card-2 hover:bg-bs-hover border border-bs-border transition-colors mb-8"
          >
            <Play className="h-5 w-5 text-accent" />
            <span className="font-medium">Watch Video</span>
            <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
          </a>
        )}

        {/* Document download */}
        {docDownloadUrl && (
          <a
            href={docDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors mb-8"
          >
            <Download className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              Download Document
            </span>
            <ExternalLink className="h-4 w-4 ml-auto text-blue-400" />
          </a>
        )}

        {/* Markdown Content */}
        {resource.content && (
          <div className="card-floating p-8 sm:p-12">
            <MarkdownContent content={resource.content} />
          </div>
        )}
      </div>

      <Footer />

      {/* Automatos Widget */}
      {platformSettings?.automatosApiKey && (
        <LearnChatbot
          apiKey={platformSettings.automatosApiKey}
          agentId={platformSettings.automatosAgentId ?? undefined}
        />
      )}
    </div>
  );
}
