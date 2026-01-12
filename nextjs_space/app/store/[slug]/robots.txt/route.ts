import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
    params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;

    // Find tenant by subdomain
    const tenant = await prisma.tenants.findUnique({
        where: { subdomain: slug },
        select: {
            subdomain: true,
            customDomain: true,
            isActive: true,
        },
    });

    if (!tenant || !tenant.isActive) {
        return new NextResponse('Tenant not found', { status: 404 });
    }

    // Build base URL - use custom domain if set, otherwise subdomain
    const baseUrl = tenant.customDomain
        ? `https://${tenant.customDomain}`
        : `https://${tenant.subdomain}.budstack.to`;

    // Build robots.txt content
    const robotsTxt = `# Robots.txt for ${tenant.customDomain || tenant.subdomain + '.budstack.to'}
# Generated dynamically by BudStack

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
