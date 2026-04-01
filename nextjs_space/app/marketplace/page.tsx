import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout, Palette, Eye, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Template Marketplace | BudStacks",
  description:
    "Browse professional storefront templates for your cannabis business. Preview and choose the perfect design.",
};

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="pt-32 pb-16 px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Template Marketplace
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Browse Templates
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Professional storefront designs ready for your cannabis business.
            Preview any template and get started in minutes.
          </p>
        </div>
      </div>

      {/* Template Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: any) => (
            <div
              key={template.id}
              className="card-floating overflow-hidden hover:scale-[1.01] transition-all duration-300"
            >
              {/* Preview Image */}
              <div className="aspect-video bg-slate-100 relative group">
                {template.signedPreviewUrl ? (
                  <img
                    src={template.signedPreviewUrl}
                    alt={`${template.name} template preview`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <Palette className="h-16 w-16 opacity-30" />
                  </div>
                )}
                {/* Hover overlay with Preview button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <Link href={`/store/preview/${template.slug}`} target="_blank">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shadow-lg rounded-xl"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                  </Link>
                </div>
                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1">
                  {template.sourceType === "COMMUNITY" && (
                    <Badge className="bg-teal-500 hover:bg-teal-600 border-none">
                      Community
                    </Badge>
                  )}
                  {template.isPremium && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                    >
                      Premium
                    </Badge>
                  )}
                  {template.category && (
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-slate-700"
                    >
                      {template.category}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-foreground">
                      {template.name}
                    </h3>
                    {template.sourceType === "COMMUNITY" &&
                      template.authorName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          By {template.authorName}
                        </p>
                      )}
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {template.description ||
                        "A professional template for your store."}
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
                          className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Card Footer — Preview Only */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Link href={`/store/preview/${template.slug}`} target="_blank" className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Template
                  </Button>
                </Link>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full card-floating p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Layout className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                Coming Soon
              </h3>
              <p className="text-muted-foreground">
                Templates are being prepared. Check back soon!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
