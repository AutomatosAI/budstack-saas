import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GUIDES, getGuide } from "@/lib/documents/registry";
import { GuideView } from "../GuideView";

export function generateStaticParams() {
  return GUIDES.filter((g) => g.status === "published").map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return {};
  return {
    title: `${guide.title} — The BudStacks Guide`,
    description: guide.summary,
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide || guide.status !== "published") notFound();
  return <GuideView guide={guide} />;
}
