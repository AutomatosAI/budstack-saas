import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/tenant/tenant';
import { getTenantBaseUrl } from '@/lib/tenant/tenant-utils';

export async function GET() {
    const tenant = await getCurrentTenant();

    if (!tenant || !tenant.isActive) {
        return new NextResponse('Tenant not found', { status: 404 });
    }

    const baseUrl = getTenantBaseUrl(tenant);

    const robotsTxt = `# Robots.txt for ${tenant.customDomain || tenant.subdomain}
# Generated dynamically by BudStacks

User-agent: *
Allow: /

# Disallow admin and API paths
Disallow: /api/
Disallow: /tenant-admin/
Disallow: /super-admin/
Disallow: /auth/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
`;

    return new NextResponse(robotsTxt, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
