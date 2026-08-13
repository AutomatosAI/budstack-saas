/**
 * US-028 — the seeded system default for the `reorderReminder` event.
 *
 * Run once per environment: `npx tsx scripts/seed-reorder-template.ts`.
 *
 * Same shape as `seed-email-templates.ts` and `seed-order-template.ts` — a
 * hand-rolled find-then-write on `(name, isSystem, tenantId: null)`, because
 * `email_templates` has no unique slug to upsert on — and idempotent for the
 * same reason: re-running refreshes the HTML of the row it already made.
 *
 * TWO ROWS, and the mapping is the load-bearing one. Without it the event mapper
 * shows the reorder row with no system default and its "Customize" button
 * disabled, so a store has no way to fork the platform's copy into one of their
 * own — which is the whole point of routing this automation through an event.
 *
 * The HTML comes from `renderReorderReminderSystemHtml`, i.e. through the same
 * US-011 pipeline an admin-authored template goes through (shell, inline,
 * sanitize LAST). It carries `{{businessName}}`, `{{businessAddress}}` and
 * `{{unsubscribeUrl}}` slots that the worker's existing compile step fills per
 * send — a system template belongs to no store, so its chrome cannot be baked
 * with one store's details.
 */

import { PrismaClient } from '@prisma/client';

import {
    REORDER_REMINDER_EVENT,
    REORDER_REMINDER_SUBJECT,
} from '../lib/email/reorder-reminder';
import { renderReorderReminderSystemHtml } from '../lib/email/reorder-reminder-content';

// Instantiate Prisma directly to avoid the tenant-scope extension in lib/db —
// this writes rows that belong to no tenant.
const prisma = new PrismaClient();

const TEMPLATE_NAME = 'Default Reorder Reminder';

async function seedReorderTemplate() {
    console.log('📧 Seeding Reorder Reminder template...');

    const contentHtml = await renderReorderReminderSystemHtml();

    let template = await prisma.email_templates.findFirst({
        where: { name: TEMPLATE_NAME, isSystem: true, tenantId: null },
    });

    if (template) {
        console.log(`  - Updating existing template: ${TEMPLATE_NAME}`);
        template = await prisma.email_templates.update({
            where: { id: template.id },
            data: { contentHtml, subject: REORDER_REMINDER_SUBJECT },
        });
    } else {
        console.log(`  - Creating new template: ${TEMPLATE_NAME}`);
        template = await prisma.email_templates.create({
            data: {
                name: TEMPLATE_NAME,
                subject: REORDER_REMINDER_SUBJECT,
                contentHtml,
                // "marketing", not "transactional": this is the column
                // `emailCategoryOfTemplate` reads to decide whether a template
                // gets an unsubscribe footer at all.
                category: 'marketing',
                isSystem: true,
                tenantId: null,
            },
        });
    }

    console.log(`  - Mapping event '${REORDER_REMINDER_EVENT}' to template...`);
    const mapping = await prisma.email_event_mappings.findFirst({
        where: { eventType: REORDER_REMINDER_EVENT, tenantId: null },
    });

    if (mapping) {
        await prisma.email_event_mappings.update({
            where: { id: mapping.id },
            data: { templateId: template.id },
        });
    } else {
        await prisma.email_event_mappings.create({
            data: {
                eventType: REORDER_REMINDER_EVENT,
                tenantId: null,
                templateId: template.id,
            },
        });
    }

    console.log('✅ Reorder Reminder template seeded!');
    console.log(
        '   Stores still have to switch the automation on themselves — it is off by default.',
    );
}

seedReorderTemplate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
