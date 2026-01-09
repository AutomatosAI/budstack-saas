
import { getEmailQueue } from './queue';
import { prisma as db } from './db';

interface SendEmailOptions {
    tenantId: string;
    to: string | string[];
    subject: string;
    html: string;
    templateName: string;
    metadata?: Record<string, any>;
    from?: string; // Optional override
}

export class MailerService {
    /**
     * Enqueues an email for delivery.
     */
    static async send(options: SendEmailOptions) {
        const { tenantId, to, subject, html, templateName, metadata, from } = options;

        // Persist intent to log immediately (optional, or rely on worker to create first log)
        // For now, we'll let the worker handle the heavy lifting, but we could create a "QUEUED" log here.

        // Add to BullMQ
        await getEmailQueue().add('send-email', {
            tenantId,
            to,
            subject,
            html,
            templateName,
            metadata,
            from
        });

        console.log(`[MailerService] Enqueued email for tenant ${tenantId} to ${to}`);

        // Create initial log entry
        try {
            await db.emailLog.create({
                data: {
                    tenantId,
                    recipient: Array.isArray(to) ? to.join(',') : to,
                    subject,
                    templateName,
                    status: 'QUEUED',
                    metadata: metadata ? JSON.stringify(metadata) : undefined,
                }
            });
        } catch (err) {
            console.error('[MailerService] Failed to create initial email log', err);
        }
    }
}
