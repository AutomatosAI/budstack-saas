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
        include: {
            products: {
                select: { slug: true, updatedAt: true },
            },
            posts: {
                where: { published: true },
                select: { slug: true, updatedAt: true },
            },
        },
    });

    if (!tenant || !tenant.isActive) {
        return new NextResponse('Tenant not found', { status: 404 });
    }

    // Build base URL - use custom domain if set, otherwise subdomain
    const baseUrl = tenant.customDomain
        ? `https://${tenant.customDomain}`
        : `https://${tenant.subdomain}.budstack.to`;

    // Format date for sitemap
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Build sitemap XML
    const staticPages = [
        { path: '', priority: '1.0', changefreq: 'daily' },
        { path: '/about', priority: '0.8', changefreq: 'monthly' },
        { path: '/contact', priority: '0.8', changefreq: 'monthly' },
        { path: '/products', priority: '0.9', changefreq: 'daily' },
        { path: '/the-wire', priority: '0.7', changefreq: 'weekly' },
        { path: '/conditions', priority: '0.7', changefreq: 'monthly' },
        { path: '/faq', priority: '0.6', changefreq: 'monthly' },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages.map(page => `
  <url>
    <loc>${baseUrl}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
  ${tenant.products.map((product: { slug: string; updatedAt: Date }) => `
  <url>
    <loc>${baseUrl}/products/${product.slug}</loc>
    <lastmod>${formatDate(product.updatedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
  ${tenant.posts.map((post: { slug: string; updatedAt: Date }) => `
  <url>
    <loc>${baseUrl}/the-wire/${post.slug}</loc>
    <lastmod>${formatDate(post.updatedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')}
</urlset>`;

    return new NextResponse(xml.trim(), {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
