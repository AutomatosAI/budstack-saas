import Link from "next/link";
import type { Guide, GuideSection } from "@/lib/documents/types";
import { GUIDES } from "@/lib/documents/registry";

/**
 * The one renderer for every guide — all layout and styling lives here so the
 * 18 content modules stay pure data and the whole series restyles in one place.
 * Uses the bs-* design system (tailwind.config.ts) throughout.
 */

function Shot({ shot }: { shot: NonNullable<GuideSection["shot"]> }) {
  return (
    <figure className="my-5">
      {/* Static export from scripts/docs-shots — refreshed each release. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/documents/shots/${shot.id}.jpg`}
        alt={shot.alt}
        loading="lazy"
        className="w-full rounded-bs-md border border-bs-border-100"
      />
      <figcaption className="mt-2 text-sm text-bs-fg-muted">{shot.caption}</figcaption>
    </figure>
  );
}

function Section({ section }: { section: GuideSection }) {
  return (
    <section id={section.id} className="bs-card bs-card-pad mb-6 scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-bs-gold">
          {section.kind === "tab" ? "Tab" : section.kind === "editor" ? "Editor" : "Concept"}
        </span>
        <h2
          className="flex-1 text-[26px] text-bs-fg"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          {section.title}
        </h2>
        {section.pro && <span className="bs-chip bs-chip-gold">Pro</span>}
      </div>

      {section.shot && <Shot shot={section.shot} />}

      <h3 className="bs-eyebrow mt-5 mb-2">What it&rsquo;s for</h3>
      <p className="max-w-[68ch] text-bs-fg">{section.whatFor}</p>

      <h3 className="bs-eyebrow mt-5 mb-2">What it does</h3>
      <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-bs-fg marker:text-bs-green">
        {section.does.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>

      {section.walkthroughs?.map((w) => (
        <div key={w.title} className="mt-5 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-5">
          <h3 className="bs-eyebrow mb-3">Try it: {w.title}</h3>
          <ol className="max-w-[68ch] list-decimal space-y-3 pl-5 text-bs-fg marker:font-semibold marker:text-bs-green">
            {w.steps.map((s, i) => (
              <li key={i}>
                {s.text}
                {s.note && <div className="mt-1 text-sm text-bs-fg-muted">{s.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      ))}

      <div className="mt-5 rounded-bs-md border border-bs-border-100 bg-bs-gold-tint p-4">
        <h3 className="bs-eyebrow mb-1 !text-bs-gold">Why you&rsquo;ll use it</h3>
        <p className="max-w-[68ch] text-bs-fg">{section.why}</p>
      </div>

      {section.notes && section.notes.length > 0 && (
        <ul className="mt-4 max-w-[68ch] space-y-1 text-sm text-bs-fg-muted">
          {section.notes.map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GuideView({ guide }: { guide: Guide }) {
  const published = GUIDES.filter((g) => g.status === "published");
  const idx = published.findIndex((g) => g.slug === guide.slug);
  const prev = idx > 0 ? published[idx - 1] : undefined;
  const next = idx >= 0 && idx < published.length - 1 ? published[idx + 1] : undefined;

  return (
    <article className="mx-auto max-w-[880px] px-5 pb-20">
      <header className="border-b-2 border-bs-green pb-5 pt-12">
        <p className="bs-eyebrow mb-2">The BudStacks Guide · Part {guide.part}</p>
        <h1
          className="text-4xl text-bs-fg md:text-5xl"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          {guide.title}
        </h1>
        <p className="mt-3 max-w-[64ch] text-lg text-bs-fg-muted">{guide.summary}</p>
        <p className="mt-2 text-sm text-bs-fg-muted">
          In your admin: <code className="rounded bg-bs-card-2 px-2 py-0.5">{guide.adminPath}</code>
        </p>
      </header>

      {guide.sections.length > 1 && (
        <nav aria-label="Sections" className="my-6 flex flex-wrap gap-2">
          {guide.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-bs-pill border border-bs-border-100 bg-bs-card px-4 py-1.5 text-sm text-bs-fg hover:border-bs-green"
            >
              {s.title}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-8">
        {guide.sections.map((s) => (
          <Section key={s.id} section={s} />
        ))}
      </div>

      {guide.improvements && guide.improvements.length > 0 && (
        <aside className="mt-10 rounded-bs-md border border-dashed border-bs-border-100 p-5 text-sm text-bs-fg-muted">
          <h2 className="bs-eyebrow mb-2">On the roadmap</h2>
          <ul className="list-disc space-y-1 pl-5">
            {guide.improvements.map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
        </aside>
      )}

      <footer className="mt-12 flex items-center justify-between border-t border-bs-border-100 pt-6 text-sm">
        <div>{prev && <Link className="text-bs-green hover:underline" href={`/documents/${prev.slug}`}>← {prev.title}</Link>}</div>
        <Link className="text-bs-fg-muted hover:underline" href="/documents">All guides</Link>
        <div>{next && <Link className="text-bs-green hover:underline" href={`/documents/${next.slug}`}>{next.title} →</Link>}</div>
      </footer>
    </article>
  );
}
