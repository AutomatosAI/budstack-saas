import { getEmailQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { createQueuedEmailLog } from "@/lib/email/email-log-linkage";
import type { EmailCategory } from "@/lib/email/suppression";

interface SendEmailOptions {
  tenantId: string;
  to: string | string[];
  subject: string;
  html: string;
  templateName: string;
  metadata?: Record<string, any>;
  variables?: Record<string, any>; // Data for dynamic rendering
  from?: string; // Optional override
  /**
   * US-004. Omit for transactional mail — the worker defaults absent to
   * transactional so every job enqueued before this field existed keeps its old
   * behaviour. Set "marketing" and the send is gated on the suppression list.
   */
  category?: EmailCategory;
}

export class MailerService {
  /**
   * Enqueues an email for delivery.
   */
  static async send(options: SendEmailOptions) {
    const {
      tenantId,
      to,
      subject,
      html,
      templateName,
      metadata,
      variables,
      from,
      category,
    } = options;

    // US-008: the QUEUED row is written BEFORE the job is enqueued so its id can
    // travel in the payload — that id is how the worker finds this exact row
    // again instead of guessing at (recipient, subject). A failed write returns
    // null and the send still goes out; the worker falls back to the heuristic.
    const logId = await createQueuedEmailLog({
      tenantId,
      to,
      subject,
      templateName,
      metadata,
    });

    // Add to BullMQ
    await getEmailQueue().add("send-email", {
      tenantId,
      to,
      subject,
      html,
      templateName,
      metadata,
      variables,
      from,
      category,
      logId: logId ?? undefined,
    });

    logger.info(`[MailerService] Enqueued email for tenant ${tenantId}`, {
      to,
    });
  }
}
