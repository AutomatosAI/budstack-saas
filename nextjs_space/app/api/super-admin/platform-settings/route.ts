
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { uploadFile } from '@/lib/s3';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();

    // Extract form fields
    const businessName = formData.get('businessName') as string;
    const tagline = formData.get('tagline') as string;
    const primaryColor = formData.get('primaryColor') as string;
    const secondaryColor = formData.get('secondaryColor') as string;
    const accentColor = formData.get('accentColor') as string;
    const backgroundColor = formData.get('backgroundColor') as string;
    const textColor = formData.get('textColor') as string;
    const headingColor = formData.get('headingColor') as string;
    const fontFamily = formData.get('fontFamily') as string;
    const headingFontFamily = formData.get('headingFontFamily') as string;
    const template = formData.get('template') as string;

    // Handle file uploads
    const logoFile = formData.get('logo') as File | null;
    const faviconFile = formData.get('favicon') as File | null;

    let logoUrl: string | undefined;
    let faviconUrl: string | undefined;

    // Upload logo if provided
    if (logoFile && logoFile.size > 0) {
      const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
      const logoKey = `platform/logo-${Date.now()}-${logoFile.name}`;
      logoUrl = await uploadFile(logoBuffer, logoKey);
    }

    // Upload favicon if provided
    if (faviconFile && faviconFile.size > 0) {
      const faviconBuffer = Buffer.from(await faviconFile.arrayBuffer());
      const faviconKey = `platform/favicon-${Date.now()}-${faviconFile.name}`;
      faviconUrl = await uploadFile(faviconBuffer, faviconKey);
    }

    // Get or create platform settings
    let settings = await prisma.platform_settings.findUnique({
      where: { id: 'platform' },
    });

    const updateData: any = {
      businessName,
      tagline: tagline || null,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      textColor,
      headingColor,
      fontFamily,
      headingFontFamily,
      template,
    };

    if (logoUrl) updateData.logoUrl = logoUrl;
    if (faviconUrl) updateData.faviconUrl = faviconUrl;

    if (!settings) {
      settings = await prisma.platform_settings.create({
        data: {
          id: 'platform',
          ...updateData,
        },
      });
    } else {
      settings = await prisma.platform_settings.update({
        where: { id: 'platform' },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Platform settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update platform settings' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.platform_settings.findUnique({
      where: { id: 'platform' },
    });

    if (!settings) {
      // Create default settings if not exists
      const newSettings = await prisma.platform_settings.create({
        data: { id: 'platform' },
      });
      return NextResponse.json({ settings: newSettings });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Platform settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform settings' },
      { status: 500 }
    );
  }
}
