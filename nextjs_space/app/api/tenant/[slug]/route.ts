import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;

        if (!slug) {
            return NextResponse.json(
                { error: 'Slug is required' },
                { status: 400 }
            );
        }

        // Find tenant by subdomain
        const tenant = await prisma.tenants.findUnique({
            where: {
                subdomain: slug
            },
            include: {
                template: true,
                tenant_branding: true
            }
        });

        if (!tenant) {
            return NextResponse.json(
                { error: 'Tenant not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            tenant: {
                id: tenant.id,
                businessName: tenant.businessName,
                subdomain: tenant.subdomain,
                settings: tenant.settings,
                template: tenant.template,
                branding: tenant.tenant_branding
            }
        });
    } catch (error) {
        console.error('Error fetching tenant:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
