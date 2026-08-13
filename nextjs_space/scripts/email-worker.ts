
import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import Handlebars from 'handlebars';
import { prisma as db } from '../lib/db';
import { decrypt } from '../lib/security/encryption';
import { campaignQueueName, emailQueueName } from '../lib/queue';
import { registerEmailHelpers, renderEmailTemplate } from '../lib/email/handlebars-helpers';
import { markEmailLogFailed, markEmailLogSent } from '../lib/email/email-log-linkage';
import {
    MISSING_FOOTER_LOG_MESSAGE,
    listUnsubscribeHeaders,
    resolveMarketingCompliance,
} from '../lib/email/marketing-headers';
import { SUPPRESSED_LOG_MESSAGE } from '../lib/email/suppression';
import { resolveSuppressionBlock } from '../lib/email/suppression-store';
import {
    finalizeCampaignIfComplete,
    loadCampaignForSend,
    markCampaignRecipient,
    type CampaignSendSource,
} from '../lib/email/campaign-recipient-store';
import {
    CAMPAIGN_CANCELLED_LOG_MESSAGE,
    CAMPAIGN_MISSING_LOG_MESSAGE,
    campaignJobTarget,
} from '../lib/email/campaign-send';
import { SCHEDULED_SEND_REASON } from '../lib/email/campaign-schedule';
import { runScheduledCampaign } from '../lib/email/campaign-scheduled-runner';
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

// Register Helpers — shared with the request-path renderer (US-006) so a test
// send compiles a template exactly the way this worker will.
registerEmailHelpers(Handlebars);

const worker = new Worker(emailQueueName, async (job: Job) => {
    console.log(`[EmailWorker] Processing job ${job.id} for tenant ${job.data.tenantId}`);
    const { tenantId, to, subject, html, templateName, from, variables, logId } = job.data;

    // US-008: `logId` is the row MailerService created before enqueueing, so the
    // outcome lands on this job's own log row. Jobs enqueued before US-008 carry
    // no logId and fall back to the (recipient, subject) heuristic inside.
    //
    // bypassTenantScope for the same reason the suppression check below uses it:
    // email_logs is tenant-scoped and the worker has no request context, so an
    // EXPLICIT null context keeps these writes legal under
    // TENANT_CONTEXT_STRICT. The helpers put tenantId in the query themselves.
    const logTarget = { logId, tenantId, to, subject, templateName };

    // US-019: present only on a campaign fan-out job. Null is every
    // transactional send and every payload enqueued before this story — the
    // same versioned-by-tolerance rule `category` and `logId` follow — and
    // leaves every branch below exactly as it was.
    const campaignTarget = campaignJobTarget(job.data);

    // Record this recipient's outcome on the campaign, then flip the campaign
    // itself to SENT if this was the last one outstanding. Both writes go
    // through bypassTenantScope for the same reason as the log writes above:
    // the worker has no request context, and the helpers put tenantId in the
    // query themselves.
    const markRecipient = async (
        status: 'SENT' | 'FAILED' | 'SUPPRESSED',
        detail: { emailLogId?: string | null; error?: string | null } = {},
    ) => {
        if (!campaignTarget) return;
        await bypassTenantScope(() =>
            markCampaignRecipient({
                recipientId: campaignTarget.recipientId,
                status,
                ...detail,
            }),
        );
        await bypassTenantScope(() =>
            finalizeCampaignIfComplete(campaignTarget.campaignId, tenantId),
        );
    };

    // Flip this job's email_logs row (or create one) to FAILED.
    const markLogFailed = (errorMessage: string) =>
        bypassTenantScope(() => markEmailLogFailed({ ...logTarget, errorMessage }));

    // PRD-220: a job past its max age is expired, NOT sent — the backlog that
    // accumulated while no worker was deployed must never blast customers
    // with weeks-old invites/confirmations the moment the worker comes up.
    // Return (don't throw) so BullMQ doesn't retry an intentional expiry.
    if (isJobExpired(job.timestamp, Date.now(), MAX_JOB_AGE_MS)) {
        const message = `Expired unsent (PRD-220): enqueued ${new Date(job.timestamp).toISOString()}, exceeds EMAIL_MAX_JOB_AGE_MS=${MAX_JOB_AGE_MS}`;
        console.warn(`[EmailWorker] Job ${job.id} ${message}`);
        await markLogFailed(message);
        await markRecipient('FAILED', { emailLogId: logId ?? null, error: message });
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
        await markRecipient('SUPPRESSED', {
            emailLogId: logId ?? null,
            error: SUPPRESSED_LOG_MESSAGE,
        });
        return { success: false, suppressed: true };
    }

    // US-019: the campaign this job belongs to, read BEFORE any rendering so a
    // cancel stops the rest of a fan-out at the first opportunity. Same
    // return-don't-throw shape as the two guards above: a cancelled campaign and
    // a deleted one are both decisions, not failures, and retrying either would
    // only reach the same answer three more times.
    let campaignSource: CampaignSendSource | null = null;
    if (campaignTarget) {
        campaignSource = await bypassTenantScope(() =>
            loadCampaignForSend(campaignTarget.campaignId, tenantId),
        );

        if (!campaignSource) {
            console.warn(`[EmailWorker] Job ${job.id} ${CAMPAIGN_MISSING_LOG_MESSAGE}`);
            await markLogFailed(CAMPAIGN_MISSING_LOG_MESSAGE);
            await markRecipient('FAILED', {
                emailLogId: logId ?? null,
                error: CAMPAIGN_MISSING_LOG_MESSAGE,
            });
            return { success: false, campaignMissing: true };
        }

        if (campaignSource.status === 'CANCELLED') {
            console.warn(`[EmailWorker] Job ${job.id} ${CAMPAIGN_CANCELLED_LOG_MESSAGE}`);
            await markLogFailed(CAMPAIGN_CANCELLED_LOG_MESSAGE);
            await markRecipient('FAILED', {
                emailLogId: logId ?? null,
                error: CAMPAIGN_CANCELLED_LOG_MESSAGE,
            });
            return { success: false, cancelled: true };
        }
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

    // US-019: a campaign carries no `html` in its payload — 5,000 copies of the
    // same email body do not belong in Redis. The stored `contentHtml` is the
    // US-011 pipeline's output with `{{unsubscribeUrl}}` left as a literal slot
    // precisely so this compile can fill it per address. Deliberately LAST, so a
    // stray event mapping can never swap a campaign the author approved for
    // another template (its templateName is reserved for the same reason).
    if (campaignSource) {
        finalHtml = renderEmailTemplate(campaignSource.contentHtml, variables || {});
        finalSubject = renderEmailTemplate(campaignSource.subject, variables || {});
    }

    // US-020: the enforced footer, checked on the RENDERED body — the last
    // moment it is still possible to refuse. US-017 asserts the stored HTML
    // carries `href="{{unsubscribeUrl}}"`; only here is it known whether the
    // worker actually filled that slot with a link a recipient can follow.
    //
    // Every transactional job — and every payload enqueued before this story,
    // which carries no `category` — resolves to no refusal and no header, so it
    // takes exactly the path it took before.
    const compliance = resolveMarketingCompliance({
        category: job.data.category,
        variables,
        html: finalHtml,
    });

    // Return, don't throw — the same intentional-drop shape as the expiry,
    // suppression and cancel guards above. Three retries would re-render the
    // same document and reach the same answer three more times.
    if (compliance.refuse) {
        console.warn(`[EmailWorker] Job ${job.id} ${MISSING_FOOTER_LOG_MESSAGE}`);
        await markLogFailed(MISSING_FOOTER_LOG_MESSAGE);
        await markRecipient('FAILED', {
            emailLogId: logId ?? null,
            error: MISSING_FOOTER_LOG_MESSAGE,
        });
        return { success: false, missingFooter: true };
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
        // US-020: RFC 8058 one-click, spread conditionally so a transactional
        // send's payload is exactly the object it was before this story. The
        // mailto half is derived from `fromAddress`, which is only resolved
        // above — the one reason these headers are built here and not with the
        // footer guard.
        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject: finalSubject,
            html: finalHtml,
            ...(compliance.unsubscribeUrl
                ? {
                      headers: listUnsubscribeHeaders(
                          compliance.unsubscribeUrl,
                          fromAddress,
                      ),
                  }
                : {}),
        });

        console.log(`[EmailWorker] Email sent: ${info.messageId}`);

        // Flip this job's own log row to SENT (US-008 — by id, not by guesswork).
        await bypassTenantScope(() =>
            markEmailLogSent({ ...logTarget, smtpResponse: info.response }),
        );

        // US-019: the delivery record, and the campaign's own completion.
        await markRecipient('SENT', { emailLogId: logId ?? null, error: null });

        return { success: true, messageId: info.messageId };

    } catch (error: any) {
        console.error(`[EmailWorker] Job ${job.id} failed:`, error);
        await markLogFailed(error.message);
        // FAILED now, and SENT later if a BullMQ retry gets through — the
        // recipient row records the latest attempt, not the first one.
        await markRecipient('FAILED', {
            emailLogId: logId ?? null,
            error: error.message,
        });
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

// US-021 — the delayed triggers that start a SCHEDULED campaign's fan-out.
//
// Its own queue and its own worker: one job here becomes thousands of jobs on
// the email queue, and the PRD-220 expiry guard above would drop a trigger
// deliberately dated weeks ahead as stale the moment it came due. Concurrency
// of 1 because each of these is a fan-out — two at once is two fan-outs
// competing for the same SMTP mailbox.
//
// The decision is made inside runScheduledCampaign against the campaign row as
// it stands right now, which is why a campaign cancelled while it waited never
// sends. Nothing here decides anything; this is the log.
const campaignWorker = new Worker(campaignQueueName, async (job: Job) => {
    const outcome = await runScheduledCampaign(job.data, String(job.id));

    if (outcome.decision === 'UNREADABLE') {
        console.warn(`[CampaignScheduler] Job ${job.id} carries no campaign target — ignored`);
    } else if (outcome.decision !== 'SEND') {
        console.warn(
            `[CampaignScheduler] Campaign ${outcome.campaignId} not sent: ${SCHEDULED_SEND_REASON[outcome.decision]}`,
        );
    } else if (outcome.refusal) {
        console.warn(
            `[CampaignScheduler] Campaign ${outcome.campaignId} refused at send time (${outcome.refusal}) — returned to draft`,
        );
    } else {
        console.log(
            `[CampaignScheduler] Campaign ${outcome.campaignId} sending: ${outcome.queued} message(s) queued`,
        );
    }

    return outcome;
}, {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }) as any,
    concurrency: 1,
});

campaignWorker.on('failed', (job, err) => {
    console.error(`[CampaignScheduler] Trigger ${job?.id} failed: ${err.message}`);
});

campaignWorker.on('error', err => {
    console.error('[CampaignScheduler] Worker error:', err);
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
    await campaignWorker.close();
    process.exit(0);
});

console.log('[EmailWorker] Worker is now listening for jobs...');
console.log('[CampaignScheduler] Listening for scheduled campaign triggers...');
