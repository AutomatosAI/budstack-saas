import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // 1. Authentication
        const session = await getServerSession(authOptions);
        if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get tenant
        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            include: { tenants: true },
        });

        if (!user?.tenants) {
            return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
        }

        const templateId = params.id;

        // 3. Verify template belongs to tenant
        const template = await prisma.tenant_templates.findFirst({
            where: {
                id: templateId,
                tenantId: user.tenants.id,
            },
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // 4. Deactivate all other templates for this tenant
        await prisma.tenant_templates.updateMany({
            where: {
                tenantId: user.tenants.id,
                id: { not: templateId },
            },
            data: { isActive: false },
        });

        // 5. Activate this template
        await prisma.tenant_templates.update({
            where: { id: templateId },
            data: { isActive: true },
        });

        // 6. Update tenant's activeTenantTemplateId
        await prisma.tenants.update({
            where: { id: user.tenants.id },
            data: { activeTenantTemplateId: templateId },
        });

        // 7. Audit log
        await createAuditLog({
            action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
            entityType: 'TenantTemplate',
            entityId: templateId,
            userId: session.user.id,
            userEmail: session.user.email,
            tenantId: user.tenants.id,
            metadata: {
                action: 'activated',
                templateName: template.templateName,
            }
        });

        console.log(`✅ Activated template ${templateId} for tenant ${user.tenants.id}`);

        return NextResponse.json({
            success: true,
            message: 'Template activated successfully',
        });

    } catch (error: any) {
        console.error('Template activation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to activate template' },
            { status: 500 }
        );
    }
}
