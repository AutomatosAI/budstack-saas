import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
    renderStoreLlmsTxt,
    type LlmsTxtConditionRow,
    type LlmsTxtPostRow,
    type LlmsTxtProductRow,
} from '@/lib/seo/llms-txt';
import { isSeoProUnlocked } from '@/lib/seo/pro-features';
import { seoText } from '@/lib/seo/store-identity';
import { readStorePageSeo } from '@/lib/seo/store-pages';
import { getCurrentTenant } from '@/lib/tenant/tenant';
import { runWithTenantContextAsync } from '@/lib/tenant/tenant-context';
import { parseTenantSettings } from '@/lib/tenant/tenant-settings';

/**
 * LLM Visibility US-003 — the store's llms.txt.
 *
 * Reached on a tenant host through the middleware rewrite, which forwards the
 * pathname verbatim for both a subdomain and a custom domain (middleware.ts —
 * `/store/${subdomain}${pathname}` and `customDomainRewritePath`) and whose
 * matcher passes `.txt` through, exactly as it does for the robots.txt this
 * route sits beside. On the apex the path-based `/store/{slug}/llms.txt` route
 * serves it, allowed by the `"/store/(.*)"` public-route entry.
 *
 * PRO ONLY, AND THIS ONE 404s. Every other storefront surface degrades on plan
 * rather than blocking (lib/entitlements/require-feature.ts) because a shopper
 * must never meet a paywall. Nothing shops here: the file is a Pro deliverable
 * addressed to a machine, and a Basic store simply does not publish one — which
 * is what a crawler must be told, since an empty 200 would be read as "this
 * store has nothing", a claim that is false.
 *
 * The document itself is built in `lib/seo/llms-txt.ts`; this handler resolves
 * the tenant, decides the plan, and runs the three queries. The row budget is
 * applied at RENDER, not in the query: truncation is only honest if the file can
 * say how much it left out, and `take` would hide that from the builder.
 */
interface StoreLlmsTxtRows {
    readonly conditions: LlmsTxtConditionRow[];
    readonly products: LlmsTxtProductRow[];
    readonly posts: LlmsTxtPostRow[];
}

export async function GET() {
    const tenant = await getCurrentTenant();

    if (!tenant || !tenant.isActive) {
        return new NextResponse('Tenant not found', { status: 404 });
    }

    // Fail-closed: an unreadable plan resolves to 'basic' and publishes no file,
    // which is the recoverable direction — a store that should have one gets it
    // back on the next request, where publishing one for a store that has not
    // paid for it cannot be taken back once a crawler has read it.
    if (!isSeoProUnlocked({ id: tenant.id, plan: tenant.plan })) {
        return new NextResponse('Not found', { status: 404 });
    }

    // Bound to a tenant context: all three models are tenant-scoped in
    // lib/db.ts, and an unbound read warns on `security.tenant_context_missing`
    // and would THROW under TENANT_CONTEXT_STRICT. The explicit `tenantId` in
    // each `where` is what makes the query correct; the binding is what makes it
    // legal. (The same arrangement as the sitemap route beside it.)
    const rows = await runWithTenantContextAsync<StoreLlmsTxtRows>(
        tenant.id,
        async () => {
            const [conditions, products, posts] = await Promise.all([
                // This tenant's OWN published guides, the filter the storefront
                // listing uses (app/api/tenant/conditions/route.ts:26-30). The
                // detail page also falls back to the platform master tenant's
                // conditions, but the listing links none of them, so naming them
                // here would advertise pages the store itself does not.
                prisma.conditions.findMany({
                    where: { tenantId: tenant.id, published: true },
                    orderBy: { name: 'asc' },
                    select: {
                        slug: true,
                        name: true,
                        description: true,
                        seo: true,
                    },
                }),
                // `deletedAt: null` is named rather than left to the soft-delete
                // extension (lib/soft-delete.ts:35) — a document advertising rows
                // an owner deleted is the defect, so the filter belongs where a
                // reader of this query can see it. `drGreenStrainId` NOT NULL for
                // the same reason the sitemap requires it: a row that was never
                // synced from Dr Green has no storefront page to point at.
                //
                // "Top products" is the owner's OWN arrangement — `displayOrder`
                // is what the storefront sorts by — with `name` breaking the ties
                // the column's `@default(0)` creates, so the budget cuts a stable
                // list rather than an arbitrary one.
                prisma.products.findMany({
                    where: {
                        tenantId: tenant.id,
                        deletedAt: null,
                        drGreenStrainId: { not: null },
                    },
                    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
                    select: {
                        drGreenStrainId: true,
                        name: true,
                        description: true,
                        seo: true,
                    },
                }),
                // Most recent first — the order the Wire index itself renders
                // (app/store/[slug]/the-wire/page.tsx:73), so "recent posts" here
                // means the same posts a visitor sees at the top of that page.
                prisma.posts.findMany({
                    where: { tenantId: tenant.id, published: true },
                    orderBy: { createdAt: 'desc' },
                    select: { slug: true, title: true, excerpt: true, seo: true },
                }),
            ]);
            return { conditions, products, posts };
        },
    );

    // What the store says it is, in the order of how deliberately it was
    // authored: the homepage SEO description an owner wrote for search, then the
    // tagline they wrote for the storefront, then the sentence the homepage's
    // own meta description falls back to. All three already ride on the row
    // `getCurrentTenant` resolved, so the summary costs no query.
    const settings = parseTenantSettings(tenant.settings, { tenantId: tenant.id });
    const summary =
        seoText(readStorePageSeo(tenant.pageSeo, 'home')?.description) ||
        seoText(settings.tagline);

    const body = renderStoreLlmsTxt({
        tenant,
        tenantId: tenant.id,
        plan: tenant.plan,
        businessName: tenant.businessName,
        address: tenant,
        summary,
        conditions: rows.conditions,
        products: rows.products,
        posts: rows.posts,
    });

    return new NextResponse(body, {
        headers: {
            // Markdown served at a `.txt` URL: `text/plain` is what every client
            // that fetches this path expects and what renders inline rather than
            // downloading. The charset is stated because the content carries
            // owner-typed names — a client defaulting to ISO-8859-1 would mangle
            // every accented business name in the file.
            'Content-Type': 'text/plain; charset=utf-8',
            // The sitemap's caching, for the same reason: the content changes
            // when the catalogue does, and an hour of staleness costs a crawler
            // nothing.
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
