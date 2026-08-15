import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/documents/registry";
import { publishedSeriesVideos } from "@/lib/documents/series-videos";
import { VideoEmbed } from "./VideoEmbed";

export const metadata: Metadata = {
  title: "The BudStacks Guide",
  description:
    "Every screen of your store admin explained — what it's for, what it does, and why you'll use it. Step by step, in plain language.",
};

export default function DocumentsIndexPage() {
  const ordered = [...GUIDES].sort((a, b) => a.part - b.part);
  const introVideos = publishedSeriesVideos();
  return (
    <main className="mx-auto max-w-[880px] px-5 pb-20">
      <header className="border-b-2 border-bs-green pb-6 pt-14">
        <p className="bs-eyebrow mb-2">BudStacks Documentation</p>
        <h1
          className="text-4xl text-bs-fg md:text-5xl"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          The BudStacks Guide
        </h1>
        <p className="mt-3 max-w-[64ch] text-lg text-bs-fg-muted">
          Every screen of your store admin, explained in plain language — what it&rsquo;s for,
          what it does, and why it earns a place in your week. Pick a part and dive in.
        </p>
      </header>

      {introVideos.length > 0 && (
        <section className="mt-8">
          <h2 className="bs-eyebrow mb-2">Start here</h2>
          {introVideos.map((v) => (
            <VideoEmbed key={v.youtubeId} video={v} />
          ))}
        </section>
      )}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {ordered.map((g) => (
          <li key={g.slug} className="bs-card bs-card-pad">
            <p className="bs-eyebrow mb-1">Part {g.part}</p>
            <h2
              className="text-2xl text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              {g.status === "published" ? (
                <Link href={`/documents/${g.slug}`} className="hover:text-bs-green">
                  {g.title}
                </Link>
              ) : (
                g.title
              )}
            </h2>
            <p className="mt-2 text-sm text-bs-fg-muted">{g.summary}</p>
            <p className="mt-3 text-sm">
              {g.status === "published" ? (
                <Link href={`/documents/${g.slug}`} className="font-medium text-bs-green hover:underline">
                  Read the guide →
                </Link>
              ) : (
                <span className="bs-chip bs-chip-muted">Coming soon</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
