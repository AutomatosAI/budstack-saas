/**
 * LLM Visibility US-004 — the heading skeleton of one authored HTML body.
 *
 * WHY HEADINGS ARE AN LLM QUESTION rather than a styling one. An answer engine
 * quotes a SECTION, not a page: the passage it extracts is bounded by the
 * headings around it, and a heading is the only label it has for what that
 * passage is about. A 3,000-word article with no subheadings is one undivided
 * block a model must either take whole or skip, and a page with two `<h1>`s has
 * told it two different things are the subject.
 *
 * THE SECOND-H1 CASE IS NOT HYPOTHETICAL IN THIS REPO. The Wire's post editor
 * offers a Heading 1 button (`components/editor/tiptap.tsx:52-57`) and the post
 * page already renders `<h1>{post.title}</h1>` above the body
 * (app/store/[slug]/the-wire/[postSlug]/page.tsx:201-203). So every use of that
 * button produces a page with two top-level headings, and the platform's own UI
 * is what invites it. That is the finding this module exists to make findable.
 *
 * REGEX, NOT A PARSER, AND DELIBERATELY. The only thing a heading check needs is
 * the ORDER of the heading levels; the tag names are the whole signal, and a
 * pattern that reads them cannot be broken by malformed markup the way a tree
 * builder can — it just sees fewer tags. `sanitize-html` (the render path's
 * parser) is a heavier dependency in an audit that runs over up to 2,000 rows,
 * and it would answer the same question no better.
 *
 * Pure and total: string in, summary out, no I/O, no throw. Everything arrives
 * as `unknown` because the rows come through the any-widened `prisma` export.
 */

/** Opening heading tags, in document order. `\b` so `<hr>` never matches. */
const HEADING_TAG = /<h([1-6])\b[^>]*>/gi;

/** Everything between angle brackets — good enough to measure prose length. */
const ANY_TAG = /<[^>]*>/g;

/** A jump that skipped at least one level, e.g. an `<h2>` followed by `<h4>`. */
export interface HeadingLevelSkip {
  readonly from: number;
  readonly to: number;
}

export interface HeadingStructure {
  /** Heading levels in document order — `[2, 3, 3, 2]` for a tidy article. */
  readonly levels: readonly number[];
  /**
   * `<h1>`s INSIDE the body. One is already too many wherever the page renders
   * a title heading of its own, which is every caller this module has.
   */
  readonly h1Count: number;
  /** The first skipped level, or null. Only the first is reported: the rest are
   * usually the same mistake repeated, and one example is what gets fixed. */
  readonly firstSkip: HeadingLevelSkip | null;
  /** Visible characters, tags removed — how long the prose actually is. */
  readonly textLength: number;
}

/**
 * The heading skeleton of an authored body, or null when there is no body at
 * all.
 *
 * Null rather than an empty summary, so "this entity has no authored HTML" (a
 * condition page, whose headings are the template's) and "this article is a
 * wall of text with no headings" stay distinguishable — only the second is a
 * finding.
 */
export function readHeadingStructure(html: unknown): HeadingStructure | null {
  if (typeof html !== "string") return null;
  const body = html.trim();
  if (!body) return null;

  const levels: number[] = [];
  // `matchAll` rather than a stateful `exec` loop: the regex is a module
  // constant and a retained `lastIndex` would make the second call on the same
  // pattern start mid-string.
  for (const match of body.matchAll(HEADING_TAG)) {
    const level = Number.parseInt(match[1], 10);
    if (level >= 1 && level <= 6) levels.push(level);
  }

  return {
    levels,
    h1Count: levels.filter((level) => level === 1).length,
    firstSkip: findFirstSkip(levels),
    textLength: body.replace(ANY_TAG, " ").replace(/\s+/g, " ").trim().length,
  };
}

/**
 * The first descent that missed a level.
 *
 * The document's own first heading is compared against `<h2>`, not against
 * nothing: the page's `<h1>` is the title, so a body that opens at `<h3>` has
 * skipped `<h2>` exactly as surely as an `<h2>` followed by an `<h4>` has. An
 * `<h1>` in the body is not a skip — it is the duplicate-h1 finding, and
 * reporting one fault as two would double the penalty for one edit.
 *
 * Going back UP is never a skip: `<h4>` then `<h2>` is a new section, which is
 * what a document does.
 */
function findFirstSkip(levels: readonly number[]): HeadingLevelSkip | null {
  let previous = 1;

  for (const level of levels) {
    if (level > previous + 1) return { from: previous, to: level };
    previous = level;
  }

  return null;
}
