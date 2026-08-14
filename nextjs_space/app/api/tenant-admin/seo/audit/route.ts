import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import { cachedSeoAudit } from "@/lib/seo/audit-cache";
import {
  runSeoAudit,
  SEO_AUDIT_MAX_ROWS_PER_TYPE,
  type SeoAuditConditionRow,
  type SeoAuditDeletedProductRow,
  type SeoAuditPostRow,
  type SeoAuditProductRow,
  type SeoAuditRedirectRow,
  type SeoAuditResult,
} from "@/lib/seo/audit";

/**
 * SEO Supercharge US-023 — the store's SEO audit.
 *
 * TWO GATES, COMPOSED, the same order every Pro surface uses:
 * `requirePermission` answers "may this MEMBER", `requireFeature` answers "may
 * this TENANT" — so a member without `canViewSeo` is refused before the plan
 * lookup runs and never learns the store's plan.
 *
 * UNLIKE THE REDIRECT ROUTES, THE READ *IS* PLAN-GATED. There the rows are the
 * owner's own authored work and hiding them behind a downgrade would look like
 * data loss; here there is no stored artefact at all — the audit is computed on
 * demand and is the Pro feature itself. A Basic tenant sees the locked card in
 * the Pro tab (`SEO_PRO_FEATURES`), which is where the upsell belongs.
 *
 * THE QUERIES ARE THE ONLY I/O IN THIS FEATURE. Everything downstream is pure
 * (`lib/seo/audit.ts`), so what this route decides is exactly which rows the
 * judgement is made over — and the two decisions that matter are stated below:
 * the row ceiling, and the separate soft-deleted read.
 *
 * Tenant context is bound by `withTenantAuth` inside `requirePermission`, so the
 * five tenant-scoped reads are legal as well as correct (each names `tenantId`
 * itself; the binding is what satisfies lib/db.ts's scope extension).
 */

const ROUTE = "/api/tenant-admin/seo/audit";

/** Deleted rows exist only to prove the sitemap is not advertising them. */
const MAX_DELETED_PRODUCTS = 500;

/**
 * `take` one past the ceiling, so "there is more" is known without a second
 * COUNT. The extra row is dropped; the type is named in `stats.truncated`.
 */
const TAKE = SEO_AUDIT_MAX_ROWS_PER_TYPE + 1;

/** Distinguishes "the store is gone" from a query failure inside the cache. */
class TenantMissingError extends Error {}

interface TenantRow {
  id: string;
  subdomain: string;
  customDomain: string | null;
  plan: string | null;
  pageSeo: unknown;
}

/** Trim to the ceiling and report whether it was hit. */
function capped<T>(rows: readonly T[], type: string): {
  rows: readonly T[];
  truncated: string | null;
} {
  return rows.length > SEO_AUDIT_MAX_ROWS_PER_TYPE
    ? { rows: rows.slice(0, SEO_AUDIT_MAX_ROWS_PER_TYPE), truncated: type }
    : { rows, truncated: null };
}

async function auditTenant(tenantId: string): Promise<SeoAuditResult | null> {
  // Row shapes are annotated rather than inferred throughout: the `prisma`
  // export in lib/db.ts is any-widened by its build-time mock Proxy, so an
  // inferred row would collapse to `any` and take the audit's types with it.
  const [tenant, products, deletedProducts, posts, conditions, redirects]: [
    TenantRow | null,
    SeoAuditProductRow[],
    SeoAuditDeletedProductRow[],
    SeoAuditPostRow[],
    SeoAuditConditionRow[],
    SeoAuditRedirectRow[],
  ] = await Promise.all([
    prisma.tenants.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        plan: true,
        pageSeo: true,
      },
    }),
    // Live products: the soft-delete extension injects `deletedAt: null`, the
    // same filter the sitemap route names explicitly.
    prisma.products.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      take: TAKE,
      select: {
        id: true,
        name: true,
        drGreenStrainId: true,
        images: true,
        seo: true,
        updatedAt: true,
      },
    }),
    // Soft-deleted products, READ SEPARATELY AND ON PURPOSE. The leak check
    // needs rows the ordinary query can never return, and an explicit
    // `deletedAt` in the where is what suppresses the extension's injected
    // filter (`injectNotDeleted` keeps a caller's own constraint —
    // lib/soft-delete.ts:105). A second small query rather than a `withDeleted`
    // wrapper around the first, so a store with thousands of deleted rows
    // cannot crowd its live products out of the row ceiling.
    prisma.products.findMany({
      where: { tenantId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: MAX_DELETED_PRODUCTS,
      select: { drGreenStrainId: true, name: true },
    }),
    // Published only, for both of these: an unpublished draft has no storefront
    // page, so auditing its metadata would be advice about a URL that 404s.
    prisma.posts.findMany({
      where: { tenantId, published: true },
      orderBy: { title: "asc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        seo: true,
        updatedAt: true,
      },
    }),
    prisma.conditions.findMany({
      where: { tenantId, published: true },
      orderBy: { name: "asc" },
      take: TAKE,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        seo: true,
        updatedAt: true,
      },
    }),
    prisma.seo_redirects.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, fromPath: true, toPath: true },
    }),
  ]);

  if (!tenant) return null;

  const cappedProducts = capped(products, "products");
  const cappedPosts = capped(posts, "posts");
  const cappedConditions = capped(conditions, "conditions");

  return runSeoAudit(
    {
      tenant: { subdomain: tenant.subdomain, customDomain: tenant.customDomain },
      tenantId: tenant.id,
      plan: tenant.plan,
      pageSeo: tenant.pageSeo,
      products: cappedProducts.rows,
      deletedProducts,
      posts: cappedPosts.rows,
      conditions: cappedConditions.rows,
      redirects,
    },
    [
      cappedProducts.truncated,
      cappedPosts.truncated,
      cappedConditions.truncated,
    ].filter((type): type is string => type !== null),
  );
}

export const GET = requirePermission(
  "canViewSeo",
  requireFeature(FEATURES.SEO_PRO, async (request, { tenantId }) => {
    // `refresh=1` recomputes rather than serving the cached result. It is a
    // read, gated identically, so the worst it costs is this tenant's own five
    // queries — see the cache module for why the alternative (invalidating from
    // every SEO write route) was left to a later story.
    const refresh =
      new URL(request.url).searchParams.get("refresh") === "1";

    try {
      const snapshot = await cachedSeoAudit(
        tenantId,
        async () => {
          const result = await auditTenant(tenantId);
          // Never cached: `cachedSeoAudit` only remembers a run that resolved,
          // and a tenant row that has gone is not a fifteen-minute truth. Only
          // reachable if the store was deleted between authenticating and here.
          if (!result) throw new TenantMissingError();
          return result;
        },
        { refresh },
      );

      return NextResponse.json(snapshot);
    } catch (error) {
      if (error instanceof TenantMissingError) {
        return NextResponse.json({ error: "Store not found" }, { status: 404 });
      }
      return apiError(error, {
        route: `GET ${ROUTE}`,
        safeMessage: "Could not run the SEO audit",
      });
    }
  }),
);
