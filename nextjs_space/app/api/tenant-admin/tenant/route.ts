import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/tenant-admin/tenant
 *
 * Fetch tenant data for the authenticated tenant admin.
 * Used to get business name for packing slips and other admin UI elements.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's tenant
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        tenantId: true,
        tenants: {
          select: {
            id: true,
            businessName: true,
            subdomain: true,
            customDomain: true,
          },
        },
      },
    });

    if (!user?.tenants) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: user.tenants.id,
      businessName: user.tenants.businessName,
      subdomain: user.tenants.subdomain,
      customDomain: user.tenants.customDomain,
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant' },
      { status: 500 }
    );
  }
}
