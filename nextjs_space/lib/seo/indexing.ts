/**
 * SEO Supercharge US-022 — indexing controls: what a Pro tenant may tell a
 * crawler about one page, and the one gate that decides whether it is told.
 *
 * THREE CONTROLS, ONE RECORD. `robots` (noindex / nofollow), `canonicalOverride`
 * (this content really lives at that URL) and `sitemapExclude` (do not advertise
 * this URL) are stored in the same authored `seo` blob as the title and
 * description — see `lib/seo/entity-seo.ts` for the shape and the fail-closed
 * parse. They are kept INDEPENDENT of each other on purpose: noindex and
 * sitemapExclude are the same intent expressed to two different systems, and a
 * store can legitimately want one without the other (a page kept out of the
 * sitemap while it still ranks, a noindexed page still listed so a crawler
 * finds the directive). US-023's audit is where "noindexed but still in the
 * sitemap" gets flagged as a finding; forcing them to move together here would
 * hide the very state the audit exists to report.
 *
 * PRO ONLY, BY GOING DORMANT. Every reader below resolves the plan through
 * `isSeoProUnlocked`, so a tenant that drops to Basic keeps its stored rules and
 * the storefront simply stops honouring them: no robots tag, the ordinary
 * canonical, every URL back in the sitemap. Nothing is deleted (the write path
 * in `entitySeoWrite` refuses to erase what it refuses to write), so an upgrade
 * restores exactly what was configured. The storefront never BLOCKS on plan —
 * this is the same degrade-don't-block contract as `lib/seo/og-image.ts`.
 *
 * Pure module — no prisma, no next/server, no request. It runs inside
 * `generateMetadata`, which has no `error.tsx` boundary above it, so every path
 * here degrades to "emit nothing" rather than throwing a blank page.
 */

import type { Metadata } from "next";
import { z } from "zod";

import {
  CANONICAL_OVERRIDE_MAX_LENGTH,
  isCanonicalOverrideUrl,
  readEntitySeo,
} from "@/lib/seo/entity-seo";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";

/** What a metadata builder needs to decide the directives for one page. */
export interface EntityIndexingSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; parsed fail-closed, so an absent value means Basic. */
  readonly plan?: unknown;
  /** Raw authored `seo` Json (or an already-parsed record — the parse is idempotent). */
  readonly seo?: unknown;
}

/** The parts of `Metadata` an indexing record decides. Both optional. */
export interface IndexingDirectives {
  /**
   * `Metadata["robots"]`, present only when the owner set a flag — omitting the
   * key entirely is what lets the page inherit the platform default
   * (app/layout.tsx declares `index, follow` plus a googleBot block).
   */
  readonly robots?: Metadata["robots"];
  /** Passed straight to `storeCanonical`'s options bag; undefined when unset. */
  readonly canonicalOverride?: string;
}

/** Is this tenant entitled to have its stored indexing controls honoured? */
export function indexingControlsUnlocked(
  tenant: Pick<EntityIndexingSource, "tenantId" | "plan">,
): boolean {
  return isSeoProUnlocked({ id: tenant.tenantId ?? "", plan: tenant.plan });
}

/**
 * The robots meta a page should declare, or undefined for "say nothing".
 *
 * BOTH directives are stated whenever either is set. `resolveRobots` replaces
 * the inherited value wholesale (next/dist/lib/metadata/resolve-metadata.js
 * :171-174 — only keys PRESENT in a segment's metadata are merged), so a page
 * that declared `{ follow: false }` alone would publish a bare `nofollow` and
 * leave indexing to the crawler's default. Naming both is unambiguous.
 *
 * The platform's `googleBot` block is deliberately NOT re-declared: a googlebot
 * tag saying `index` beside a robots tag saying `noindex` is resolved by Google
 * in favour of googlebot, which would make every noindex here a no-op. The cost
 * is that a page with a directive of its own loses `max-image-preview:large` —
 * for a page the owner is hiding, that is not a loss.
 */
function robotsDirective(
  noindex: boolean,
  nofollow: boolean,
): Metadata["robots"] | undefined {
  if (!noindex && !nofollow) return undefined;
  return { index: !noindex, follow: !nofollow };
}

/**
 * The indexing directives for one page — `{}` for a Basic tenant, whatever the
 * owner authored for a Pro one.
 */
export function seoIndexingDirectives(
  source: EntityIndexingSource,
): IndexingDirectives {
  if (!indexingControlsUnlocked(source)) return {};

  const seo = readEntitySeo(source.seo);
  const robots = robotsDirective(
    seo.robots?.noindex === true,
    seo.robots?.nofollow === true,
  );

  return {
    ...(robots ? { robots } : {}),
    ...(seo.canonicalOverride
      ? { canonicalOverride: seo.canonicalOverride }
      : {}),
  };
}

/**
 * Should this entity's URL be left out of the store's sitemap?
 *
 * Takes the plan decision as a resolved boolean rather than re-deriving it per
 * row: one sitemap render calls this once per product, post, condition and
 * static page, and the tenant's plan does not change between them.
 */
export function isSitemapExcluded(seo: unknown, proUnlocked: boolean): boolean {
  return proUnlocked && readEntitySeo(seo).sitemapExclude === true;
}

/**
 * The Zod fields every SEO PUT route adds to its own schema.
 *
 * Spread into an existing `z.object({...}).strict()` rather than composed with
 * `.merge()`, so each route keeps one readable schema and `.strict()` still
 * rejects anything unlisted. Presence is meaningful — see
 * {@link hasIndexingFields} — so nothing here carries a `.default()`.
 *
 * `canonicalOverride` accepts "" as well as a valid URL: "" is how the editor
 * says "cleared", and refusing it would leave an owner unable to remove an
 * override they had set.
 */
export const INDEXING_SEO_FIELDS = {
  robots: z
    .object({
      noindex: z.boolean().optional(),
      nofollow: z.boolean().optional(),
    })
    .strict()
    .optional(),
  canonicalOverride: z
    .string()
    .max(CANONICAL_OVERRIDE_MAX_LENGTH)
    .refine((value) => value === "" || isCanonicalOverrideUrl(value), {
      message: "Enter a full https:// URL, or leave this empty.",
    })
    .optional(),
  sitemapExclude: z.boolean().optional(),
} as const;

/** The three keys as a parsed body carries them. */
export interface IndexingFieldsPresence {
  readonly robots?: unknown;
  readonly canonicalOverride?: unknown;
  readonly sitemapExclude?: unknown;
}

/**
 * Did this request try to write an indexing control?
 *
 * PRESENCE, not truthiness: clearing a canonical override (`""`) and lifting a
 * noindex (`{ noindex: false }`) are both Pro writes, and a gate that only
 * noticed truthy values would let a Basic tenant undo a Pro configuration.
 * JSON has no `undefined`, so an absent key is exactly a key the caller did not
 * send — which is how the Basic editor saves a title without either being
 * refused or wiping the rules underneath it.
 */
export function hasIndexingFields(body: IndexingFieldsPresence): boolean {
  return (
    body.robots !== undefined ||
    body.canonicalOverride !== undefined ||
    body.sitemapExclude !== undefined
  );
}
