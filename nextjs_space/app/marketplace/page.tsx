import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/storage/s3";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout, Palette, Eye, Sparkles } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Theme Marketplace | BudStacks",
  description:
    "Browse professional storefront themes for your cannabis business. Preview and choose the perfect design.",
};

// PRD-220 AC-C2: this page has no dynamic API calls, so without a revalidate
// window Next.js would statically cache the signed preview URLs it bakes in
// at render time — and getFileUrl's signatures expire after 3600s (see
// lib/storage/s3.ts). Revalidate well under that so the page re-signs before
// any cached copy's URLs go stale.
export const revalidate = 1800;

/** Sign an S3 key to a URL, or pass through if already a URL */
async function signUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  try {
    return await getFileUrl(key);
  } catch {
    return null;
  }
}

export default async function MarketplacePage() {
  // Fetch all public, active templates
  const baseTemplatesRaw = await prisma.templates.findMany({
    where: { isActive: true, isPublic: true },
    orderBy: { createdAt: "desc" },
  });

  // Sign preview URLs
  const templates = await Promise.all(
    baseTemplatesRaw.map(async (t: any) => ({
      ...t,
      signedPreviewUrl: await signUrl(t.previewUrl || t.thumbnailUrl),
    })),
  );

  return (
    <div className="budstacks-theme min-h-screen">
      <Navbar />
      {/* Header */}
      <div className="pt-32 pb-16 px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Theme Marketplace
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Browse Themes
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Professional storefront designs ready for your cannabis business.
            Preview any theme and get started in minutes.
          </p>
        </div>
      </div>

      {/* Template Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: any) => (
            <div
              key={template.id}
              className="bs-card overflow-hidden hover:scale-[1.01] transition-all duration-300"
            >
              {/* Preview Image */}
              <div className="aspect-video bg-bs-bg-2 relative group">
                {template.signedPreviewUrl ? (
                  <img
                    src={template.signedPreviewUrl}
                    alt={`${template.name} theme preview`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-bs-fg-3">
                    <Palette className="h-16 w-16 opacity-30" />
                  </div>
                )}
                {/* Hover overlay with Preview button */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <Link href={`/store/preview/${template.slug}`} target="_blank">
                    <Button
                      size="sm"
                      className="shadow-lg rounded-xl bg-bs-green-500 text-bs-bg-0 hover:bg-bs-green-400"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                  </Link>
                </div>
                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1">
                  {template.sourceType === "COMMUNITY" && (
                    <Badge className="bg-bs-green-400/15 text-bs-green-300 border border-bs-green-400/25 hover:bg-bs-green-400/20">
                      Community
                    </Badge>
                  )}
                  {template.isPremium && (
                    <Badge className="bg-bs-gold-400/15 text-bs-gold-300 border border-bs-gold-400/25 hover:bg-bs-gold-400/20">
                      Premium
                    </Badge>
                  )}
                  {template.category && (
                    <Badge className="bg-bs-bg-1/90 text-bs-fg-1 border border-bs-border backdrop-blur-sm">
                      {template.category}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-bs-fg">
                      {template.name}
                    </h3>
                    {template.sourceType === "COMMUNITY" &&
                      template.authorName && (
                        <p className="text-xs text-bs-fg-muted mt-1">
                          By {template.authorName}
                        </p>
                      )}
                    <p className="text-sm text-bs-fg-muted line-clamp-2 mt-2">
                      {template.description ||
                        "A professional theme for your store."}
                    </p>
                  </div>
                </div>
                {template.tags && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {(Array.isArray(template.tags)
                      ? template.tags
                      : typeof template.tags === "string"
                        ? template.tags.split(",").map((t: string) => t.trim())
                        : []
                    )
                      .slice(0, 3)
                      .map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs font-bs-mono uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-bs-green-400/10 text-bs-green-300 border border-bs-green-400/20"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Card Footer — Preview Only */}
              <div className="p-4 border-t border-bs-border bg-bs-bg-2/40">
                <Link href={`/store/preview/${template.slug}`} target="_blank" className="block">
                  <Button
                    size="sm"
                    className="w-full rounded-xl bg-bs-green-400/10 text-bs-green-300 border border-bs-green-400/25 hover:bg-bs-green-400/20"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Theme
                  </Button>
                </Link>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full bs-card p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-bs-bg-2 border border-bs-border flex items-center justify-center mb-4">
                <Layout className="h-6 w-6 text-bs-fg-3" />
              </div>
              <h3 className="font-display text-lg font-bold text-bs-fg mb-2">
                Coming Soon
              </h3>
              <p className="text-bs-fg-muted">
                Themes are being prepared. Check back soon!
              </p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
