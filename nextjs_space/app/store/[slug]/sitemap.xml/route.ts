import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
    buildStoreSitemapEntries,
    renderSitemapXml,
    type StoreSitemapProductRow,
    type StoreSitemapSlugRow,
} from '@/lib/seo/sitemap';
import { getCurrentTenant } from '@/lib/tenant/tenant';
import { runWithTenantContextAsync } from '@/lib/tenant/tenant-context';

/**
 * SEO US-006 — the store's sitemap. Which URLs it publishes and how they are
 * serialised lives in lib/seo/sitemap.ts (shared with the pages' canonicals);
 * this route is the tenant resolution and the three queries feeding it.
 *
 * Row shapes are stated explicitly: the `prisma` export in lib/db.ts is
 * any-widened by its build-time mock Proxy, so through a generic
 * (`runWithTenantContextAsync<T>`) `any` collapses the inferred T to `{}`.
 */
interface StoreSitemapRows {
    readonly products: StoreSitemapProductRow[];
    readonly posts: StoreSitemapSlugRow[];
    readonly conditions: StoreSitemapSlugRow[];
}

export async function GET() {
    const tenant = await getCurrentTenant();

    if (!tenant || !tenant.isActive) {
        return new NextResponse('Tenant not found', { status: 404 });
    }

    // Bound to a tenant context: all three models are tenant-scoped in
    // lib/db.ts, and an unbound read warns on `security.tenant_context_missing`
    // and would THROW under TENANT_CONTEXT_STRICT — which for this route means
    // no sitemap at all. The explicit `tenantId` in each `where` is what makes
    // the query correct; the binding is what makes it legal.
    const rows = await runWithTenantContextAsync<StoreSitemapRows>(
        tenant.id,
        async () => {
            const [products, posts, conditions] = await Promise.all([
                // `deletedAt: null` is named rather than left to the soft-delete
                // extension (lib/soft-delete.ts:35): a sitemap advertising rows an
                // owner deleted is the defect, so the filter belongs where a reader
                // of this query can see it. `drGreenStrainId` NOT NULL is the same
                // rule as `productPath` — a row that was never synced from Dr Green
                // has no storefront page to point at.
                // `seo` rides on each query for US-022's `sitemapExclude` — one
                // more column on a query that already runs, never a second read.
                prisma.products.findMany({
                    where: {
                        tenantId: tenant.id,
                        deletedAt: null,
                        drGreenStrainId: { not: null },
                    },
                    select: { drGreenStrainId: true, updatedAt: true, seo: true },
                }),
                prisma.posts.findMany({
                    where: { tenantId: tenant.id, published: true },
                    select: { slug: true, updatedAt: true, seo: true },
                }),
                // The same filter the storefront listing uses
                // (app/api/tenant/conditions/route.ts:26-30): this tenant's own
                // published rows. The detail page ALSO resolves the platform
                // master tenant's conditions as a fallback, but the listing links
                // none of them, so publishing them here would advertise URLs the
                // store itself does not.
                prisma.conditions.findMany({
                    where: { tenantId: tenant.id, published: true },
                    select: { slug: true, updatedAt: true, seo: true },
                }),
            ]);
            return { products, posts, conditions };
        },
    );

    const xml = renderSitemapXml(
        buildStoreSitemapEntries({
            tenant,
            ...rows,
            // US-022 — both ride on the row `getCurrentTenant` already resolved,
            // so the exclusion gate costs no query. A Basic tenant's stored
            // flags are dormant and every URL stays published.
            tenantId: tenant.id,
            plan: tenant.plan,
            pageSeo: tenant.pageSeo,
        }),
    );

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
