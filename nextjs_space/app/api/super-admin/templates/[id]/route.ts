import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from '@/lib/audit-log';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super admin access required' },
        { status: 403 }
      );
    }

    const templateId = params.id;

    // Find template
    const template = await prisma.templates.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check if template is in use
    if (template._count.tenants > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete template: ${template._count.tenants} tenant(s) are currently using this template. Please reassign those tenants to a different template first.`,
          tenantsCount: template._count.tenants,
        },
        { status: 409 }
      );
    }

    console.log(`[Template Delete] Deleting template: ${template.name} (${template.slug})`);

    // Delete template directory
    const templateDir = path.join(process.cwd(), 'templates', template.slug || template.name);
    try {
      const dirExists = await fs.access(templateDir).then(() => true).catch(() => false);
      if (dirExists) {
        await fs.rm(templateDir, { recursive: true, force: true });
        console.log(`[Template Delete] Directory removed: ${templateDir}`);
      }
    } catch (fsError: any) {
      console.error('[Template Delete] Error removing directory:', fsError);
      // Continue with database deletion even if file system cleanup fails
    }

    // Delete database record
    await prisma.templates.delete({
      where: { id: templateId },
    });

    console.log('[Template Delete] Database record deleted');

    // Create audit log
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.DELETED,
      entityType: 'template',
      entityId: templateId,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        templateName: template.name,
        templateSlug: template.slug || '',
      },
      ...clientInfo,
    });

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" deleted successfully`,
    });

  } catch (error: any) {
    console.error('[Template Delete] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
