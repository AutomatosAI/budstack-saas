/**
 * SEO Supercharge US-010 — writing ONE page's entry in `tenants.pageSeo`.
 *
 * THE DEFECT THIS CLOSES: the write route read the whole `pageSeo` blob, merged
 * one key in JS, then wrote the whole blob back. Two owners saving two DIFFERENT
 * pages at the same time both read the same "before", and the second write
 * replaced the first — About silently reverted the moment Contact was saved.
 * Last-write-wins across the entire SEO surface, from a normal two-tab session.
 *
 * THE FIX: one UPDATE statement, so Postgres serialises the merge on the row
 * lock instead of the app losing the race between its own SELECT and UPDATE.
 * A concurrent save of a different page now composes; a concurrent save of the
 * SAME page still resolves to whichever transaction commits last, which is the
 * only sane answer to two people typing into one field.
 *
 * WHY RAW SQL. Prisma has no partial-update operator for a `Json` column — the
 * fluent API can only set the whole value, which is the read-modify-write this
 * removes. `$queryRaw` is the house idiom for what Prisma cannot express
 * (app/api/tenant-admin/analytics/route.ts:174, app/tenant-admin/layout.tsx:102)
 * and the tagged template parameterises every value.
 *
 * The write PLAN is a pure function so the merge rules are unit-testable with no
 * database; only the statement that applies it needs Postgres.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ENTITY_SEO_CONTENT_KEYS,
  entitySeoContent,
  isEmptyEntitySeo,
  readEntitySeo,
  type EntitySeo,
} from "@/lib/seo/entity-seo";
import {
  legacyStorePageSeoKeysReplacedBy,
  type StoreSeoPageKey,
} from "@/lib/seo/store-pages";

/** What one save does to the blob: drop these keys, then merge this object. */
export interface PageSeoWritePlan {
  /**
   * Keys to remove before merging. Always contains `pageKey` itself — deleting
   * then re-adding is how a single statement covers both "save" and "clear",
   * and it keeps the array non-empty so its Postgres type is never ambiguous.
   * Also carries any legacy key this page replaced (see
   * `dropLegacyStorePageSeoKeys` — same retirement rule, applied in SQL).
   */
  readonly removeKeys: readonly string[];
  /**
   * The entry to merge back in: `{ [pageKey]: authored }`, or `{}` when the
   * owner cleared every field. Serialised into the statement as one jsonb
   * parameter.
   */
  readonly patch: Readonly<Record<string, EntitySeo>>;
}

/**
 * The merge one save performs — pure, no I/O.
 *
 * Parses the submitted fields through `readEntitySeo`, which trims and drops
 * empty strings, so the same "no empty values stored" rule the sibling entity
 * routes apply holds here too, from one implementation.
 */
export function planPageSeoWrite(
  pageKey: StoreSeoPageKey,
  seo: unknown,
): PageSeoWritePlan {
  const authored = readEntitySeo(seo);

  return {
    removeKeys: [pageKey, ...legacyStorePageSeoKeysReplacedBy(pageKey)],
    patch: isEmptyEntitySeo(authored) ? {} : { [pageKey]: authored },
  };
}

/** The stored blob, `{}` when the tenant has authored nothing. */
export type StoredPageSeo = Record<string, unknown>;

export interface StorePageSeoWriteOptions {
  /**
   * US-022 — true when this save may NOT write indexing controls (a Basic
   * tenant, or any caller that sent none). The stored `robots`,
   * `canonicalOverride` and `sitemapExclude` for this page are carried through
   * instead of being replaced, so a downgrade leaves the rules dormant rather
   * than deleting them the next time an owner edits a title.
   */
  readonly preserveIndexing?: boolean;
}

/**
 * Apply one page's SEO to `tenants.pageSeo` atomically and return the new blob.
 *
 * `null` when no live tenant row matched — the caller 404s rather than reporting
 * a save that touched nothing.
 */
export async function writeStorePageSeo(
  tenantId: string,
  pageKey: StoreSeoPageKey,
  seo: unknown,
  options: StorePageSeoWriteOptions = {},
): Promise<StoredPageSeo | null> {
  const { removeKeys, patch } = planPageSeoWrite(pageKey, seo);

  // One `- $n::text` per retired key rather than a single `text[]` parameter:
  // `jsonb - text` is the unambiguous form, and every value stays a scalar bind
  // so nothing depends on how the driver serialises a JS array. `removeKeys` is
  // never empty (it always holds `pageKey`), so the chain always has a term.
  const removals = Prisma.join(
    removeKeys.map((key) => Prisma.sql`- ${key}::text`),
    " ",
  );

  // The entry to merge back in, as ONE term either way — which is what keeps
  // this a single statement in both arms.
  //
  // The preserve arm rebuilds the page's own entry in SQL: the stored record
  // minus every CONTENT key (so only US-022's indexing keys survive), with the
  // submitted content merged on top. The content keys are the same tuple the JS
  // splitter uses, so the two cannot drift. `NULLIF(..., '{}')` plus
  // `jsonb_strip_nulls` is how an entry that ends up empty is DELETED rather
  // than left behind as `{"about": {}}`.
  //
  // It reads the page's OWN key and never a legacy one: a retired entry (`faq`)
  // predates the indexing controls by definition, so there is nothing there to
  // carry, and it is still dropped by `${removals}` exactly as before.
  const entry = options.preserveIndexing
    ? Prisma.sql`
        jsonb_strip_nulls(
          jsonb_build_object(
            ${pageKey}::text,
            NULLIF(
              (
                -- Nested CASE, not an AND: Postgres does not promise to
                -- short-circuit a boolean, and '->' on a non-object blob must
                -- not be evaluated at all.
                CASE WHEN jsonb_typeof("pageSeo") = 'object'
                     THEN CASE WHEN jsonb_typeof("pageSeo" -> ${pageKey}::text) = 'object'
                               THEN "pageSeo" -> ${pageKey}::text
                               ELSE '{}'::jsonb
                          END
                     ELSE '{}'::jsonb
                END
                ${Prisma.join(
                  ENTITY_SEO_CONTENT_KEYS.map(
                    (key) => Prisma.sql`- ${key}::text`,
                  ),
                  " ",
                )}
              ) || ${JSON.stringify(entitySeoContent(readEntitySeo(seo)))}::jsonb,
              '{}'::jsonb
            )
          )
        )`
    : Prisma.sql`${JSON.stringify(patch)}::jsonb`;

  const rows: Array<{ pageSeo: StoredPageSeo | null }> = await prisma.$queryRaw(
    Prisma.sql`
      UPDATE "tenants"
      SET "pageSeo" = NULLIF(
            (
              -- Anything that is not a JSON object is treated as no data at
              -- all, mirroring readStorePageSeo's fail-closed parse. Without
              -- this a corrupt blob (a string, an array) would abort the
              -- statement on the '-' operator and 500 the save.
              CASE WHEN jsonb_typeof("pageSeo") = 'object'
                   THEN "pageSeo"
                   ELSE '{}'::jsonb
              END
              ${removals}
            ) || ${entry},
            '{}'::jsonb
          ),
          "updatedAt" = NOW()
      WHERE "id" = ${tenantId}
        -- Matches the read path: soft-delete injects deletedAt IS NULL into
        -- findUnique (lib/soft-delete.ts:154-162) but never into an update, so
        -- the statement states it itself.
        AND "deletedAt" IS NULL
      RETURNING "pageSeo"
    `,
  );

  const row = rows[0];
  if (!row) return null;
  return row.pageSeo ?? {};
}
