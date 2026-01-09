
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { copyDirectory } from '@/lib/s3-copy';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify Authentication
        const session = await getServerSession(authOptions);
        if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { baseTemplateId } = body;

        if (!baseTemplateId) {
            return NextResponse.json({ error: 'Missing baseTemplateId' }, { status: 400 });
        }

        // 2. Verify Tenant
        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            include: { tenants: true },
        });

        if (!user?.tenant) {
            return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
        }

        // 3. Fetch Base Template
        const baseTemplate = await prisma.templates.findUnique({
            where: { id: baseTemplateId },
        });

        if (!baseTemplate) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // 4. Define S3 paths
        const sourceS3Prefix = `templates/${baseTemplate.slug || baseTemplateId}/`;
        const timestamp = Date.now();
        const destS3Prefix = `tenants/${user.tenant.id}/templates/${timestamp}/`;

        console.log(`Cloning template from ${sourceS3Prefix} to ${destS3Prefix}`);

        // 5. Copy S3 Assets
        const filesCopied = await copyDirectory(sourceS3Prefix, destS3Prefix);
        console.log(`Copied ${filesCopied} files`);

        // 6. Create TenantTemplate Record with correct schema fields
        const tenantTemplate = await prisma.tenant_templates.create({
            data: {
                tenantId: user.tenant.id,
                baseTemplateId: baseTemplateId,
                templateName: `${baseTemplate.name}`,
                s3Path: destS3Prefix,
                isActive: false, // Not active by default - user needs to activate
                isDraft: true,
            },
        });

        console.log(`Created tenant template: ${tenantTemplate.id}`);

        // 7. Audit Log
        await createAuditLog({
            action: AUDIT_ACTIONS.TEMPLATE.CREATED,
            entityType: 'TenantTemplate',
            entityId: tenantTemplate.id,
            userId: session.user.id,
            userEmail: session.user.email,
            tenantId: user.tenant.id,
            metadata: {
                baseTemplateId,
                baseTemplateName: baseTemplate.name,
                filesCopied,
                s3Path: destS3Prefix
            }
        });

        return NextResponse.json({
            success: true,
            templateId: tenantTemplate.id,
            templateName: tenantTemplate.templateName,
            filesCopied
        });

    } catch (error: any) {
        console.error('Template Cloning Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
