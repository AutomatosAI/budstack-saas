import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GUIDES, getGuide } from "@/lib/documents/registry";
import { generatePlatformGuideMetadata } from "@/lib/seo/generate-platform-metadata";
import { GuideView } from "../GuideView";

export function generateStaticParams() {
  return GUIDES.filter((g) => g.status === "published").map((g) => ({ slug: g.slug }));
}

/**
 * US-015 — each guide is its own authorable route (`platformSeoRoutes()` lists
 * every published one), so a `platform_seo_settings` row keyed on
 * `/documents/{slug}` overrides THIS guide and no other. The guide's own title
 * and summary stay the fallback: the seed left the guides rowless, and
 * inheriting `/documents`'s row would mean authoring one title silently
 * retitled eighteen pages.
 *
 * An unknown slug still returns `{}` — the page calls `notFound()` below, and
 * building metadata for a guide that is not there would put the platform
 * default title on a 404.
 */
export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> | Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return {};

  return generatePlatformGuideMetadata(params.slug, {
    title: `${guide.title} — The BudStacks Guide`,
    description: guide.summary,
  });
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide || guide.status !== "published") notFound();
  return <GuideView guide={guide} />;
}
