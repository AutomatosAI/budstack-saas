import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Play,
  FileText,
  Search,
  GraduationCap,
} from "lucide-react";
import type { Metadata } from "next";
import { Navbar, Footer } from "@/components/landing";
import { LearnSearch } from "./learn-search";
import { LearnChatbot } from "./learn-chatbot";

export const metadata: Metadata = {
  title: "Learning Center | BudStacks",
  description:
    "Guides, tutorials, and documentation to help you get the most out of BudStacks.",
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  "getting-started": {
    label: "Getting Started",
    icon: "rocket",
    color: "bg-emerald-100 text-emerald-800",
  },
  templates: {
    label: "Templates",
    icon: "palette",
    color: "bg-purple-100 text-purple-800",
  },
  orders: {
    label: "Orders & Products",
    icon: "shopping-cart",
    color: "bg-blue-100 text-blue-800",
  },
  integrations: {
    label: "Integrations",
    icon: "plug",
    color: "bg-amber-100 text-amber-800",
  },
  branding: {
    label: "Branding & Design",
    icon: "paintbrush",
    color: "bg-pink-100 text-pink-800",
  },
  general: {
    label: "General",
    icon: "book",
    color: "bg-slate-100 text-slate-800",
  },
};

async function signUrl(
  key: string | null | undefined,
): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  try {
    return await getFileUrl(key);
  } catch {
    return null;
  }
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "video":
      return <Play className="h-4 w-4" />;
    case "guide":
      return <FileText className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}

export default async function LearnPage() {
  const resources = await prisma.learning_resources.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Sign cover images
  const items = await Promise.all(
    resources.map(async (r: (typeof resources)[number]) => ({
      ...r,
      signedCoverImage: await signUrl(r.coverImage),
    })),
  );

  // Group by category
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category || "general";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  // Fetch platform settings for Automatos widget
  const platformSettings = await prisma.platform_settings.findUnique({
    where: { id: "platform" },
    select: { automatosApiKey: true, automatosAgentId: true },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      {/* Header */}
      <div className="pt-32 pb-12 px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            <GraduationCap className="h-4 w-4" />
            Learning Center
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Docs & Guides
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to build and manage your storefront.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mt-8">
          <LearnSearch />
        </div>
      </div>

      {/* Content by Category */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {grouped.size === 0 && (
          <div className="card-floating p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground mb-2">
              Coming Soon
            </h3>
            <p className="text-muted-foreground">
              Documentation is being prepared. Check back soon!
            </p>
          </div>
        )}

        {Array.from(grouped.entries()).map(([category, categoryItems]) => {
          const meta = CATEGORY_META[category] || CATEGORY_META.general;
          return (
            <div key={category} className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <Badge variant="secondary" className={meta.color}>
                  {meta.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {categoryItems.length}{" "}
                  {categoryItems.length === 1 ? "article" : "articles"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/learn/${item.slug}`}
                    className="block"
                  >
                    <div className="card-floating overflow-hidden hover:scale-[1.01] transition-all duration-300 h-full">
                      {/* Cover Image */}
                      {item.signedCoverImage ? (
                        <div className="aspect-video bg-slate-100 relative">
                          <img
                            src={item.signedCoverImage}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          {item.type === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                                <Play className="h-5 w-5 text-white ml-0.5" />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                          <TypeIcon type={item.type} />
                        </div>
                      )}

                      {/* Body */}
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <TypeIcon type={item.type} />
                          <span className="text-xs text-muted-foreground capitalize">
                            {item.type}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-foreground line-clamp-2">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                            {item.description}
                          </p>
                        )}
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {item.tags.slice(0, 3).map((tag: string) => (
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
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Footer />

      {/* Automatos Widget for docs assistance */}
      {platformSettings?.automatosApiKey && (
        <LearnChatbot
          apiKey={platformSettings.automatosApiKey}
          agentId={platformSettings.automatosAgentId ?? undefined}
        />
      )}
    </div>
  );
}
