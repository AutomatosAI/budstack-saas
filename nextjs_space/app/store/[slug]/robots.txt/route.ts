import { NextResponse } from 'next/server';
import { parseAiCrawlerPolicy } from '@/lib/seo/ai-crawlers';
import { isSeoProUnlocked } from '@/lib/seo/pro-features';
import { renderStoreRobotsTxt } from '@/lib/seo/robots-txt';
import { getCurrentTenant } from '@/lib/tenant/tenant';
import { parseTenantSettings } from '@/lib/tenant/tenant-settings';
import { getTenantBaseUrl } from '@/lib/tenant/tenant-utils';

/**
 * The store's robots.txt. Reached on a tenant host through the middleware
 * rewrite (middleware.ts allows `/robots.txt` before the auth check), and on the
 * apex through the path-based `/store/{slug}` route.
 *
 * LLM Visibility US-001 added the AI crawler section. The body itself is built
 * in `lib/seo/robots-txt.ts`; this handler resolves the tenant, decides whether
 * a policy applies, and caches. Everything it needs — `plan` and `settings` —
 * rides on the row `getCurrentTenant` already resolved, so the policy costs no
 * extra query.
 *
 * PLAN DEGRADES, IT DOES NOT BLOCK: a Basic tenant renders the pre-US-001 file,
 * byte for byte, with any stored policy left dormant in the column. The
 * storefront never 403s on plan (lib/entitlements/require-feature.ts).
 */
export async function GET() {
    const tenant = await getCurrentTenant();

    if (!tenant || !tenant.isActive) {
        return new NextResponse('Tenant not found', { status: 404 });
    }

    // Fail-closed on the PLAN (an unreadable value resolves to 'basic') and
    // fail-OPEN on the POLICY (an unreadable value resolves to 'open'). The two
    // directions are deliberate: neither a plan blip nor a malformed settings
    // blob may be read as "this store asked to be hidden from AI answers".
    const settings = parseTenantSettings(tenant.settings, { tenantId: tenant.id });
    const aiCrawlerPolicy = isSeoProUnlocked({ id: tenant.id, plan: tenant.plan })
        ? parseAiCrawlerPolicy(settings.aiCrawlerPolicy)
        : null;

    const robotsTxt = renderStoreRobotsTxt({
        host: tenant.customDomain || tenant.subdomain,
        baseUrl: getTenantBaseUrl(tenant),
        aiCrawlerPolicy,
    });

    return new NextResponse(robotsTxt, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
