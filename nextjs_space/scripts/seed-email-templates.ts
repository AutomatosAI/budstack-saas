
import { render } from '@react-email/components';
import { PrismaClient } from '@prisma/client';
import WelcomeEmail from '../emails/welcome';
import PasswordResetEmail from '../emails/password-reset';
import TenantWelcomeEmail from '../emails/tenant-welcome';

// Instantiate Prisma directly to avoid potential side-effects from lib/db
const prisma = new PrismaClient();

async function seedEmailTemplates() {
    console.log('📧 Seeding Email Templates...');

    const templates = [
        {
            key: 'welcome', // Matches System Event ID
            name: 'Default User Welcome',
            subject: 'Welcome to {{businessName}}!',
            category: 'transactional',
            component: WelcomeEmail({
                userName: '{{name}}',
                tenantName: '{{businessName}}',
                loginUrl: '{{loginUrl}}',
                primaryColor: '#10b981'
            })
        },
        {
            key: 'passwordReset',
            name: 'Default Password Reset',
            subject: 'Reset your password for {{businessName}}',
            category: 'transactional',
            component: PasswordResetEmail({
                userName: '{{name}}',
                resetLink: '{{resetLink}}',
                tenantName: '{{businessName}}'
            })
        },
        {
            key: 'tenantWelcome',
            name: 'Default New Tenant Welcome',
            subject: 'Welcome to your new BudStacks workspace',
            category: 'system',
            component: TenantWelcomeEmail({
                adminName: '{{name}}',
                tenantName: '{{businessName}}',
                subdomain: '{{subdomain}}',
                loginUrl: '{{loginUrl}}'
            })
        }
    ];

    for (const t of templates) {
        // 1. Render HTML
        const html = await render(t.component);

        // 2. Upsert Template
        console.log(`Processing ${t.name}...`);

        // We use a deterministic way to find existing system templates?
        // We don't have a unique slug. We can look up by name + isSystem.
        let template = await prisma.email_templates.findFirst({
            where: { name: t.name, isSystem: true, tenantId: null }
        });

        if (template) {
            console.log(`  - Updating existing template: ${t.name}`);
            template = await prisma.email_templates.update({
                where: { id: template.id },
                data: {
                    contentHtml: html,
                    subject: t.subject
                }
            });
        } else {
            console.log(`  - Creating new template: ${t.name}`);
            template = await prisma.email_templates.create({
                data: {
                    name: t.name,
                    subject: t.subject,
                    contentHtml: html,
                    category: t.category,
                    isSystem: true,
                    tenantId: null // System-wide
                }
            });
        }

        // 3. Create/Update System Mapping
        console.log(`  - Mapping event '${t.key}' to template...`);
        // Check mapping
        const mapping = await prisma.email_event_mappings.findFirst({
            where: { eventType: t.key, tenantId: null }
        });

        if (mapping) {
            await prisma.email_event_mappings.update({
                where: { id: mapping.id },
                data: { templateId: template.id }
            });
        } else {
            await prisma.email_event_mappings.create({
                data: {
                    eventType: t.key,
                    tenantId: null,
                    templateId: template.id
                }
            });
        }
    }

    console.log('✅ Email Templates Seeded!');
}

seedEmailTemplates()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
