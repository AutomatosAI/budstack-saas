
import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import Handlebars from 'handlebars';
import { prisma as db } from '../lib/db';
import { decrypt } from '../lib/security/encryption';
import { emailQueueName } from '../lib/queue';
import { SUPPRESSED_LOG_MESSAGE } from '../lib/email/suppression';
import { resolveSuppressionBlock } from '../lib/email/suppression-store';
import { bypassTenantScope } from '../lib/tenant/tenant-scope-policy';
import {
    DEFAULT_MAX_JOB_AGE_MS,
    DEFAULT_QUEUED_ALERT_AGE_MS,
    EMAIL_WORKER_HEARTBEAT_KEY,
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_TTL_SECONDS,
    QUEUED_ALERT_DEBOUNCE_MS,
    isJobExpired,
    msFromEnv,
    queuedAlertLine,
} from '../lib/email/worker-health';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_JOB_AGE_MS = msFromEnv(process.env.EMAIL_MAX_JOB_AGE_MS, DEFAULT_MAX_JOB_AGE_MS);
const QUEUED_ALERT_AGE_MS = msFromEnv(process.env.EMAIL_QUEUED_ALERT_AGE_MS, DEFAULT_QUEUED_ALERT_AGE_MS);

console.log('[EmailWorker] Starting...');
console.log(`[EmailWorker] Connecting to Redis: ${REDIS_URL.replace(/\/\/.*@/, '//***@')}`);
console.log(`[EmailWorker] Max job age ${MAX_JOB_AGE_MS}ms; queued-alert threshold ${QUEUED_ALERT_AGE_MS}ms`);

// Register Helpers
Handlebars.registerHelper('multiply', (a, b) => {
    return (Number(a) * Number(b)).toFixed(2);
});
Handlebars.registerHelper('toFixed', (num) => {
    return Number(num).toFixed(2);
});

const worker = new Worker(emailQueueName, async (job: Job) => {
    console.log(`[EmailWorker] Processing job ${job.id} for tenant ${job.data.tenantId}`);
    const { tenantId, to, subject, html, templateName, from, variables } = job.data;

    // Flip the matching QUEUED email_logs row (or create one) to FAILED.
    const markLogFailed = async (errorMessage: string) => {
        const queuedLog = await db.email_logs.findFirst({
            where: {
                tenantId,
                recipient: Array.isArray(to) ? to.join(',') : to,
                subject,
                status: 'QUEUED',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (queuedLog) {
            await db.email_logs.update({
                where: { id: queuedLog.id },
                data: { status: 'FAILED', errorMessage },
            });
        } else {
            await db.email_logs.create({
                data: {
                    tenantId,
                    recipient: Array.isArray(to) ? to.join(',') : to,
                    subject,
                    templateName,
                    status: 'FAILED',
                    errorMessage,
                },
            });
        }
    };

    // PRD-220: a job past its max age is expired, NOT sent — the backlog that
    // accumulated while no worker was deployed must never blast customers
    // with weeks-old invites/confirmations the moment the worker comes up.
    // Return (don't throw) so BullMQ doesn't retry an intentional expiry.
    if (isJobExpired(job.timestamp, Date.now(), MAX_JOB_AGE_MS)) {
        const message = `Expired unsent (PRD-220): enqueued ${new Date(job.timestamp).toISOString()}, exceeds EMAIL_MAX_JOB_AGE_MS=${MAX_JOB_AGE_MS}`;
        console.warn(`[EmailWorker] Job ${job.id} ${message}`);
        await markLogFailed(message);
        return { success: false, expired: true };
    }

    // US-004: a MARKETING job addressed to a suppressed recipient must never be
    // sent. Same shape as the expiry guard above — return, don't throw, because
    // this is an intentional drop and a retry would only re-decide it the same
    // way. Transactional jobs (and every legacy payload, which carries no
    // `category`) skip the check entirely and are unaffected.
    //
    // bypassTenantScope binds an EXPLICIT null context so this stays correct
    // when TENANT_CONTEXT_STRICT is on: the worker runs outside any request, and
    // resolveSuppressionBlock puts the tenantId in the query itself. The callee
    // is async and starts executing synchronously inside the bound store, so the
    // lazy Prisma promise is awaited while the context is still live.
    const suppression = await bypassTenantScope(() =>
        resolveSuppressionBlock({ tenantId, to, category: job.data.category }),
    );
    if (suppression.blocked) {
        console.warn(
            `[EmailWorker] Job ${job.id} ${SUPPRESSED_LOG_MESSAGE} (${suppression.suppressed.length} recipient(s))`,
        );
        await markLogFailed(SUPPRESSED_LOG_MESSAGE);
        return { success: false, suppressed: true };
    }

    let finalHtml = html;
    let finalSubject = subject;

    // 0. Check for Dynamic Template Override (DB)
    try {
        // Resolve tenantId for mapping lookup (SYSTEM -> null)
        const lookupTenantId = tenantId === 'SYSTEM' ? null : tenantId;

        // Try to find specific mapping
        let mapping = await db.email_event_mappings.findFirst({
            where: {
                tenantId: lookupTenantId,
                eventType: templateName,
                isActive: true,
            },
            include: { template: true }
        });

        // Check if the finding mapping's template is actually active
        if (mapping && mapping.template && !mapping.template.isActive) {
            console.log(`[EmailWorker] Mapped template ${mapping.template.name} is inactive. Ignored.`);
            mapping = null;
        }

        // If no specific tenant mapping, check for system default mapping (if we are looking up for a tenant)
        if (!mapping && lookupTenantId) {
            mapping = await db.email_event_mappings.findFirst({
                where: {
                    tenantId: null, // System default
                    eventType: templateName,
                    isActive: true,
                },
                include: { template: true }
            });
            // Check system template activity too
            if (mapping && mapping.template && !mapping.template.isActive) {
                console.log(`[EmailWorker] System Default template ${mapping.template.name} is inactive.`);
                mapping = null;
            }
        }

        if (mapping && mapping.template) {
            console.log(`[EmailWorker] Using Dynamic Template Override: ${mapping.template.name}`);

            // Compile Content with Handlebars
            const template = Handlebars.compile(mapping.template.contentHtml);
            finalHtml = template(variables || {});

            // Compile Subject with Handlebars
            const subjectTemplate = Handlebars.compile(mapping.template.subject);
            finalSubject = subjectTemplate(variables || {});
        }
    } catch (e) {
        console.error('[EmailWorker] Failed to resolve dynamic template:', e);
        // Continue with default provided html/subject
    }

    try {
        let transporter;
        let fromAddress = from;

        // 1. Try to fetch Tenant SMTP Config
        const tenant = await db.tenants.findUnique({
            where: { id: tenantId },
            select: { settings: true, businessName: true }
        });

        const tenantSettings = tenant?.settings as any;

        if (tenantSettings?.smtp?.host && tenantSettings?.smtp?.user && tenantSettings?.smtp?.password) {
            // Use Tenant SMTP
            console.log(`[EmailWorker] Using Tenant SMTP for ${tenantId}`);
            try {
                const password = decrypt(tenantSettings.smtp.password);
                transporter = nodemailer.createTransport({
                    host: tenantSettings.smtp.host,
                    port: tenantSettings.smtp.port || 587,
                    secure: tenantSettings.smtp.secure || false,
                    auth: {
                        user: tenantSettings.smtp.user,
                        pass: password,
                    },
                });

                if (!fromAddress) {
                    fromAddress = tenantSettings.smtp.fromEmail
                        ? `"${tenantSettings.smtp.fromName || tenant.businessName}" <${tenantSettings.smtp.fromEmail}>`
                        : `"${tenant.businessName}" <${tenantSettings.smtp.user}>`;
                }
            } catch (err) {
                console.error('[EmailWorker] Failed to setup Tenant SMTP, falling back to System:', err);
                // Fallback will happen below if transporter is still undefined
            }
        }

        // 2. Fallback to System SMTP (Platform Config)
        if (!transporter) {
            const platformConfig = await db.platform_config.findUnique({
                where: { id: 'config' },
            });

            if (platformConfig?.emailServer) {
                // Decrypt and use platform SMTP
                const smtpUrl = decrypt(platformConfig.emailServer);
                console.log('[EmailWorker] Using platform SMTP configuration');
                transporter = nodemailer.createTransport(smtpUrl);

                if (!fromAddress) {
                    fromAddress = platformConfig.emailFrom || 'noreply@budstacks.io';
                }
            } else if (process.env.EMAIL_SERVER) {
                // 3. Fallback to environment variable
                console.log('[EmailWorker] Using EMAIL_SERVER environment variable');
                transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);

                if (!fromAddress) {
                    fromAddress = process.env.EMAIL_FROM || 'noreply@budstacks.io';
                }
            } else {
                throw new Error('No system email configuration found. Please configure SMTP in platform settings.');
            }
        }

        // Send Email
        console.log(`[EmailWorker] Sending email to ${to}...`);
        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject: finalSubject,
            html: finalHtml,
        });

        console.log(`[EmailWorker] Email sent: ${info.messageId}`);

        // Update the email log to SENT status
        // Find the most recent QUEUED log for this tenant/recipient/subject
        const queuedLog = await db.email_logs.findFirst({
            where: {
                tenantId,
                recipient: Array.isArray(to) ? to.join(',') : to,
                subject,
                status: 'QUEUED',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (queuedLog) {
            await db.email_logs.update({
                where: { id: queuedLog.id },
                data: {
                    status: 'SENT',
                    smtpResponse: info.response,
                    sentAt: new Date(),
                },
            });
        } else {
            // Create a new SENT log if we couldn't find the QUEUED one
            await db.email_logs.create({
                data: {
                    tenantId,
                    recipient: Array.isArray(to) ? to.join(',') : to,
                    subject,
                    templateName,
                    status: 'SENT',
                    smtpResponse: info.response,
                    sentAt: new Date(),
                },
            });
        }

        return { success: true, messageId: info.messageId };

    } catch (error: any) {
        console.error(`[EmailWorker] Job ${job.id} failed:`, error);
        await markLogFailed(error.message);
        throw error;
    }
}, {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }) as any,
    concurrency: 5, // Process up to 5 emails concurrently
});

worker.on('completed', job => {
    console.log(`[EmailWorker] Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.log(`[EmailWorker] Job ${job?.id} failed: ${err.message}`);
});

worker.on('error', err => {
    console.error('[EmailWorker] Worker error:', err);
});

// PRD-220 AC-A2/A3 — liveness heartbeat + stuck-queue alert. The super-admin
// email-health route reads the heartbeat key; Railway log alerting matches
// the QUEUED_ALERT_PREFIX line (see docs/runbooks/email-worker.md).
const healthRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
let lastQueuedAlertAt = 0;
const healthTimer = setInterval(async () => {
    try {
        await healthRedis.set(
            EMAIL_WORKER_HEARTBEAT_KEY,
            new Date().toISOString(),
            'EX',
            HEARTBEAT_TTL_SECONDS,
        );

        // Only send-eligible rows count as "stuck" — anything past the max
        // job age belongs to the expiry guard / drain script, not the alert.
        const oldest = await db.email_logs.findFirst({
            where: {
                status: 'QUEUED',
                createdAt: { gt: new Date(Date.now() - MAX_JOB_AGE_MS) },
            },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        });

        const alert = queuedAlertLine(
            oldest?.createdAt?.getTime() ?? null,
            Date.now(),
            QUEUED_ALERT_AGE_MS,
        );
        if (alert && Date.now() - lastQueuedAlertAt > QUEUED_ALERT_DEBOUNCE_MS) {
            console.error(alert);
            lastQueuedAlertAt = Date.now();
        }
    } catch (e) {
        console.error('[EmailWorker] Health tick failed:', e);
    }
}, HEARTBEAT_INTERVAL_MS);

process.on('SIGTERM', async () => {
    console.log('[EmailWorker] SIGTERM received — closing gracefully...');
    clearInterval(healthTimer);
    await worker.close();
    process.exit(0);
});

console.log('[EmailWorker] Worker is now listening for jobs...');
