import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Fetch product SEO
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { tenantId: true },
    });

    if (!user?.tenantId) {
        return NextResponse.json({ error: 'No tenant' }, { status: 400 });
    }

    const product = await prisma.products.findFirst({
        where: { id, tenantId: user.tenantId },
        select: { id: true, name: true, slug: true, seo: true },
    });

    if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
}

// PUT - Update product SEO
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { tenantId: true },
    });

    if (!user?.tenantId) {
        return NextResponse.json({ error: 'No tenant' }, { status: 400 });
    }

    // Verify product belongs to tenant
    const existingProduct = await prisma.products.findFirst({
        where: { id, tenantId: user.tenantId },
    });

    if (!existingProduct) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, ogImage } = body;

    // Build SEO object, removing empty values
    const seo: Record<string, string> = {};
    if (title?.trim()) seo.title = title.trim();
    if (description?.trim()) seo.description = description.trim();
    if (ogImage?.trim()) seo.ogImage = ogImage.trim();

    const updated = await prisma.products.update({
        where: { id },
        data: {
            seo: Object.keys(seo).length > 0 ? seo : null,
            updatedAt: new Date(),
        },
        select: { id: true, name: true, seo: true },
    });

    return NextResponse.json(updated);
}
