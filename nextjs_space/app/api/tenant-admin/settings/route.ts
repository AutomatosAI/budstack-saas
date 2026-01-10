import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await req.json();
    const { customDomain, drGreenApiUrl, drGreenApiKey, drGreenSecretKey } = body;

    const dataToUpdate: any = {
      customDomain: customDomain || null,
      drGreenApiUrl: drGreenApiUrl || null,
      drGreenApiKey: drGreenApiKey || null,
    };

    // Only update secret key if a new one is provided (non-empty)
    if (drGreenSecretKey && drGreenSecretKey.trim() !== '') {
      console.log('Encrypting new secret key...');
      try {
        dataToUpdate.drGreenSecretKey = encrypt(drGreenSecretKey);
      } catch (e) {
        console.error('Encryption failed:', e);
        throw e;
      }
    }

    console.log('Updating tenant with data:', { ...dataToUpdate, drGreenSecretKey: dataToUpdate.drGreenSecretKey ? '***' : undefined });

    // Update tenant
    await prisma.tenants.update({
      where: { id: user.tenants.id },
      data: dataToUpdate,
    });

    console.log('Settings updated successfully');
    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings detailed:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
