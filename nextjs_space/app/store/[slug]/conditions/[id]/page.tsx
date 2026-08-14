import type { Metadata } from "next";
import { cache } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { prisma } from "@/lib/db";
import {
  buildBreadcrumbJsonLd,
  conditionBreadcrumbTrail,
} from "@/lib/seo/breadcrumb-json-ld";
import {
  CONDITION_NOT_FOUND_TITLE,
  buildConditionMetadata,
} from "@/lib/seo/condition-metadata";
import { STORE_NOT_FOUND_TITLE } from "@/lib/seo/store-metadata";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";

import { ConditionDetailClient } from "./condition-detail-client";

interface ConditionDetailPageProps {
  params: {
    slug: string;
    id: string;
  };
}

/**
 * The route segment is `[id]` but it carries the condition SLUG — the listing
 * links `conditions/{condition.slug}` (conditions-client.tsx:342) and the API
 * the body calls resolves it against the `(tenantId, slug)` unique
 * (app/api/tenant/conditions/[slug]/route.ts:32-39).
 *
 * The row shape is stated explicitly because the `prisma` export in lib/db.ts is
 * any-widened by its build-time mock Proxy — through a generic
 * (`runWithTenantContextAsync<T>`) `any` collapses the inferred T to `{}`.
 */
interface ConditionSeoRow {
  readonly slug: unknown;
  readonly name: unknown;
  readonly description: unknown;
  readonly image: unknown;
  readonly seo: unknown;
}

const CONDITION_SEO_SELECT = {
  slug: true,
  name: true,
  description: true,
  image: true,
  seo: true,
} as const;

/**
 * The tenant whose conditions every store falls back to, or null when the
 * platform has none configured. `tenants` is not tenant-scoped in lib/db.ts, so
 * this needs no context binding.
 */
const loadMasterTenantId = cache(async (): Promise<string | null> => {
  const masterSlug = process.env.PLATFORM_MASTER_TENANT_SLUG;
  if (!masterSlug) return null;

  const master: { id: string } | null = await prisma.tenants.findUnique({
    where: { subdomain: masterSlug },
    select: { id: true },
  });
  return master?.id ?? null;
});

/**
 * The condition this URL names, or null — resolved the SAME way the page body's
 * API route resolves it (app/api/tenant/conditions/[slug]/route.ts): the store's
 * own row first, then the master tenant's shared row. Metadata that disagreed
 * with the body would title a fully rendered page "Condition Not Found".
 *
 * `findFirst` with flat fields, bound to a tenant context, on BOTH reads:
 *  - `conditions` is tenant-scoped (lib/db.ts:61) and `generateMetadata` resolves
 *    OUTSIDE the layout's context scope, so an unbound read warns on
 *    `security.tenant_context_missing` and would THROW under
 *    TENANT_CONTEXT_STRICT — inside metadata, where a throw is a blank page.
 *  - The binding is also what makes the master read WORK: `applyTenantScope`
 *    spreads the CONTEXT tenantId over the `where` (lib/db.ts:115-118), so a
 *    master lookup made under the visiting tenant's context is silently
 *    rewritten to that tenant and can never match.
 *  - `findFirst` with flat fields, never `findUnique` on the `tenantId_slug`
 *    compound: the extension rewrites findUnique→findFirst, which rejects a
 *    compound key (the trap documented at api/tenant-admin/posts/route.ts:56).
 *
 * `published` is deliberately NOT filtered — the body's API route does not
 * filter it either, and metadata that 404s a page the visitor can read is worse
 * than the underlying visibility gap (flagged in the journal).
 */
const loadCondition = cache(
  async (tenantId: string, slug: string): Promise<ConditionSeoRow | null> => {
    const own = await runWithTenantContextAsync<ConditionSeoRow | null>(
      tenantId,
      () =>
        prisma.conditions.findFirst({
          where: { tenantId, slug },
          select: CONDITION_SEO_SELECT,
        }),
    );
    if (own) return own;

    const masterTenantId = await loadMasterTenantId();
    if (!masterTenantId || masterTenantId === tenantId) return null;

    return runWithTenantContextAsync<ConditionSeoRow | null>(
      masterTenantId,
      () =>
        prisma.conditions.findFirst({
          where: { tenantId: masterTenantId, slug },
          select: CONDITION_SEO_SELECT,
        }),
    );
  },
);

/** SEO US-005 — conditions.seo, on the page type that had no metadata at all. */
export async function generateMetadata({
  params,
}: ConditionDetailPageProps): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { title: STORE_NOT_FOUND_TITLE };

  const condition = await loadCondition(tenant.id, params.id);
  // The body calls notFound() for the same case; metadata resolves first, so it
  // answers with the matching title instead of the platform's.
  if (!condition) return { title: CONDITION_NOT_FOUND_TITLE };

  return buildConditionMetadata({
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    // The RESOLVED slug, not the raw param: equal whenever the lookup succeeded,
    // and the one the listing links to.
    slug: condition.slug,
    name: condition.name,
    description: condition.description,
    image: condition.image,
    seo: condition.seo,
  });
}

/**
 * SEO US-016 — the breadcrumb trail for a condition page.
 *
 * `loadCondition` is the `cache()`d loader `generateMetadata` above already
 * calls with the SAME arguments, so resolving the row here costs nothing on a
 * normal render: React dedupes it within the request. The body itself stays
 * client-rendered — this only adds the node the crawler reads.
 *
 * Nothing here can block the page: `buildBreadcrumbJsonLd` returns [] for a
 * Basic tenant and for a row with no usable name, and `<JsonLd>` renders nothing
 * for [].
 */
export default async function ConditionDetailPage({
  params,
}: ConditionDetailPageProps) {
  const tenant = await getCurrentTenant();
  const condition = tenant ? await loadCondition(tenant.id, params.id) : null;

  const jsonLdNodes =
    tenant && condition
      ? buildBreadcrumbJsonLd(
          {
            tenantId: tenant.id,
            plan: tenant.plan,
            subdomain: tenant.subdomain,
            customDomain: tenant.customDomain,
          },
          // The RESOLVED slug, not the raw param — the one the listing links to.
          conditionBreadcrumbTrail(condition.name, condition.slug),
        )
      : [];

  return (
    <>
      <JsonLd nodes={jsonLdNodes} />
      <ConditionDetailClient />
    </>
  );
}
