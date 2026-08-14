/**
 * SEO Supercharge US-023 — the checks themselves. One pure function per family
 * of fault, each taking the snapshot and returning findings.
 *
 * NOTHING HERE DOES I/O, and nothing here fetches. Every check is a total
 * function over an already-collected snapshot (`audit-snapshot.ts`), which is
 * what makes the whole audit table-driven in tests: a case is a row shape in, a
 * finding list out, with no database and no clock. The route owns the queries,
 * the snapshot owns the normalising, and this owns the judgement.
 *
 * EVERY FINDING CARRIES A DEEP LINK. A check that cannot name the editor which
 * fixes what it found does not belong here — see `SeoAuditTarget`.
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { productPath } from "@/lib/seo/product-paths";
import {
  findRedirectChainProblem,
  redirectMatchKey,
  type SeoRedirectRule,
} from "@/lib/seo/redirects";
import { seoText } from "@/lib/seo/store-identity";
import type {
  AuditSitemap,
  SeoAuditEntity,
  SeoAuditInput,
  SeoAuditRedirectRow,
} from "@/lib/seo/audit-snapshot";
import {
  SEO_AUDIT_DESCRIPTION_MAX_LENGTH,
  SEO_AUDIT_DESCRIPTION_MIN_LENGTH,
  SEO_AUDIT_TITLE_MAX_LENGTH,
  SEO_AUDIT_TITLE_MIN_LENGTH,
  SEO_AUDIT_WEIGHTS,
  type SeoAuditCheckId,
  type SeoAuditFinding,
  type SeoAuditTarget,
} from "@/lib/seo/audit-types";

function finding(
  check: SeoAuditCheckId,
  message: string,
  target: SeoAuditTarget,
): SeoAuditFinding {
  return {
    check,
    severity: SEO_AUDIT_WEIGHTS[check].severity,
    message,
    target,
  };
}

function targetFor(entity: SeoAuditEntity): SeoAuditTarget {
  return { tab: entity.tab, entityId: entity.entityId, label: entity.label };
}

/**
 * Title, description, share image and alt text — the four things an owner
 * authors, checked for every entity.
 */
export function auditEntityFields(
  entities: readonly SeoAuditEntity[],
): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];

  for (const entity of entities) {
    const target = targetFor(entity);
    const title = entity.seo.title ?? "";
    const description = entity.seo.description ?? "";

    if (!title) {
      findings.push(
        finding(
          "title-missing",
          `“${entity.label}” has no search title, so results show ${entity.titleFallback}.`,
          target,
        ),
      );
    } else if (title.length > SEO_AUDIT_TITLE_MAX_LENGTH) {
      findings.push(
        finding(
          "title-long",
          `“${entity.label}” has a ${title.length}-character title; Google clips it around ${SEO_AUDIT_TITLE_MAX_LENGTH}.`,
          target,
        ),
      );
    } else if (title.length < SEO_AUDIT_TITLE_MIN_LENGTH) {
      findings.push(
        finding(
          "title-short",
          `“${entity.label}” has a ${title.length}-character title — there is room for ${SEO_AUDIT_TITLE_MAX_LENGTH - title.length} more.`,
          target,
        ),
      );
    }

    if (!description) {
      findings.push(
        finding(
          "description-missing",
          entity.descriptionFallback
            ? `“${entity.label}” has no search description, so results show ${entity.descriptionFallback}.`
            : `“${entity.label}” has no search description and nothing to fall back on — the store description appears instead, on this and every other ${entity.noun}.`,
          target,
        ),
      );
    } else if (description.length > SEO_AUDIT_DESCRIPTION_MAX_LENGTH) {
      findings.push(
        finding(
          "description-long",
          `“${entity.label}” has a ${description.length}-character description; results clip it around ${SEO_AUDIT_DESCRIPTION_MAX_LENGTH}.`,
          target,
        ),
      );
    } else if (description.length < SEO_AUDIT_DESCRIPTION_MIN_LENGTH) {
      findings.push(
        finding(
          "description-short",
          `“${entity.label}” has a ${description.length}-character description — there is room for ${SEO_AUDIT_DESCRIPTION_MAX_LENGTH - description.length} more.`,
          target,
        ),
      );
    }

    if (entity.expectsOwnImage && !entity.seo.ogImage && !entity.hasOwnImage) {
      findings.push(
        finding(
          "og-image-missing",
          `“${entity.label}” has no image of its own, so a shared link gets the generic branded card.`,
          target,
        ),
      );
    }

    if (entity.hasOwnImage && !entity.seo.imageAlt) {
      findings.push(
        finding(
          "image-alt-missing",
          `“${entity.label}” has an image with no alt text — screen readers and image search both read that field.`,
          target,
        ),
      );
    }
  }

  return findings;
}

/**
 * Two pages in one store claiming the same title.
 *
 * AUTHORED titles only. A duplicate that arises from two products genuinely
 * called the same thing upstream is a catalogue problem, not something an owner
 * fixes in this editor — and reporting it here would be advice they cannot act
 * on. Compared case-insensitively with whitespace collapsed, because that is
 * how a crawler sees "Blue Dream " and "blue dream".
 */
export function auditDuplicateTitles(
  entities: readonly SeoAuditEntity[],
): SeoAuditFinding[] {
  const groups = new Map<string, SeoAuditEntity[]>();

  for (const entity of entities) {
    const title = (entity.seo.title ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!title) continue;
    const group = groups.get(title);
    if (group) group.push(entity);
    else groups.set(title, [entity]);
  }

  const findings: SeoAuditFinding[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const entity of group) {
      findings.push(
        finding(
          "title-duplicate",
          `“${entity.label}” shares its search title with ${group.length - 1} other page${group.length > 2 ? "s" : ""} in this store.`,
          targetFor(entity),
        ),
      );
    }
  }

  return findings;
}

/**
 * A page told not to index itself while the sitemap still advertises it.
 *
 * `lib/seo/indexing.ts` keeps `noindex` and `sitemapExclude` independent on
 * purpose — its docstring names this story as where the combination gets
 * reported rather than prevented. Both states are legitimate; what an owner
 * usually means is both, and being told which one they set is the point.
 */
export function auditNoindexInSitemap(
  entities: readonly SeoAuditEntity[],
): SeoAuditFinding[] {
  return entities
    .filter((entity) => entity.seo.robots?.noindex === true && entity.inSitemap)
    .map((entity) =>
      finding(
        "noindex-in-sitemap",
        `“${entity.label}” is set to noindex but is still listed in your sitemap, which asks crawlers to visit a page you told them to ignore.`,
        targetFor(entity),
      ),
    );
}

/**
 * Sitemap health: is anything advertised, is everything that should be there
 * there, and is anything there that should not be.
 */
export function auditSitemapHealth(
  input: SeoAuditInput,
  entities: readonly SeoAuditEntity[],
  sitemap: AuditSitemap,
): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  const content = entities.filter((entity) => entity.tab !== "pages");

  // Nothing but the static pages reached the sitemap although the store has
  // content. One finding for the store, not one per row: the cause is shared.
  if (content.length > 0 && !content.some((entity) => entity.inSitemap)) {
    findings.push(
      finding(
        "sitemap-empty",
        `Your sitemap lists none of this store's ${content.length} products, posts or condition pages — search engines have no way to discover them.`,
        { tab: "pages", label: "Sitemap" },
      ),
    );
  } else {
    // Per-entity: it has a URL, the owner did not hide it, and the sitemap does
    // not carry it. Compares the real builder's output against the path helpers
    // the storefront routes use — see the module docstring.
    for (const entity of content) {
      if (entity.path === null) continue;
      if (entity.seo.sitemapExclude === true) continue;
      if (entity.inSitemap) continue;
      findings.push(
        finding(
          "sitemap-url-form",
          `“${entity.label}” has a live URL that your sitemap does not list, so crawlers have to stumble on it.`,
          targetFor(entity),
        ),
      );
    }
  }

  // Products with no usable storefront URL: never synced from Dr Green, or
  // carrying an id that does not survive being put in a path.
  for (const entity of entities) {
    if (entity.tab !== "products" || entity.path !== null) continue;
    findings.push(
      finding(
        "product-no-page",
        `“${entity.label}” has no Dr Green strain id, so it has no product page and cannot appear in search at all.`,
        targetFor(entity),
      ),
    );
  }

  // Soft-deleted products whose URL is still being advertised. Should be
  // impossible — the sitemap query filters `deletedAt: null` — which is exactly
  // why it is worth asserting on live data rather than only in a test.
  for (const row of input.deletedProducts) {
    const strainId = seoText(row.drGreenStrainId);
    if (!strainId) continue;
    const loc = storeCanonical(input.tenant, productPath(strainId));
    if (!sitemap.locs.has(loc)) continue;
    findings.push(
      finding(
        "sitemap-deleted-leak",
        `“${seoText(row.name) || "A deleted product"}” was deleted but its URL is still in your sitemap, so crawlers keep requesting a page that is gone.`,
        { tab: "products", label: seoText(row.name) || "Deleted product" },
      ),
    );
  }

  return findings;
}

/**
 * Redirect loops and chains.
 *
 * Loops are refused at write time (`findRedirectChainProblem`, reused here
 * rather than reimplemented) — but only against the table as it stood at that
 * moment, and rows predate the validation. A loop that did get in produces
 * ERR_TOO_MANY_REDIRECTS on the owner's own storefront and a dropped page in
 * every crawler, so it is worth checking the stored table rather than trusting
 * that every row went through the current write path.
 *
 * A chain (`/a` → `/b` → `/c`) is legal and works; it just costs a hop and
 * dilutes the signal a 301 passes along. Hence `info`, not a refusal.
 */
export function auditRedirectTable(
  rows: readonly SeoAuditRedirectRow[],
): SeoAuditFinding[] {
  const rules = rows.flatMap((row) => {
    const id = seoText(row.id);
    const fromPath = seoText(row.fromPath);
    const toPath = seoText(row.toPath);
    const fromKey = redirectMatchKey(fromPath);
    const toKey = redirectMatchKey(toPath);
    if (!id || !fromKey || !toKey) return [];
    return [{ id, fromPath, toPath, fromKey, toKey }];
  });

  const fromKeys = new Set(rules.map((rule) => rule.fromKey));
  const findings: SeoAuditFinding[] = [];

  for (const rule of rules) {
    const others: SeoRedirectRule[] = rules
      .filter((other) => other.id !== rule.id)
      .map((other) => ({
        fromPath: other.fromKey,
        toPath: other.toKey,
        statusCode: 301,
      }));

    const problem = findRedirectChainProblem(others, {
      fromPath: rule.fromPath,
      toPath: rule.toPath,
    });

    const target: SeoAuditTarget = {
      tab: "redirects",
      entityId: rule.id,
      label: rule.fromPath,
    };

    if (problem) {
      findings.push(
        finding(
          "redirect-loop",
          problem === "self_redirect"
            ? `${rule.fromPath} redirects to itself, so the page never loads.`
            : `${rule.fromPath} redirects into a loop that leads back to it — visitors get ERR_TOO_MANY_REDIRECTS and crawlers drop the page.`,
          target,
        ),
      );
      continue;
    }

    if (fromKeys.has(rule.toKey)) {
      findings.push(
        finding(
          "redirect-chain",
          `${rule.fromPath} redirects to ${rule.toPath}, which redirects again — point it at the final destination to save a hop.`,
          target,
        ),
      );
    }
  }

  return findings;
}
