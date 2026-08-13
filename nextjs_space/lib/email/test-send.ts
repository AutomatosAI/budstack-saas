/**
 * US-006 — "send this template to me", shared by the tenant-admin and
 * super-admin routes.
 *
 * The job is enqueued under a RESERVED templateName so the worker's dynamic
 * override cannot fire for it (the mapping routes reject that event type), and
 * the HTML rendered here is exactly what lands in the inbox. That fidelity is
 * the whole point of the story, which is also why the rendered output is not
 * re-sanitized — contentHtml was sanitized on save
 * (lib/security/email-sanitize.ts) and the only values injected here are the
 * canned samples from lib/email/sample-variables.ts.
 */
import { sendEmail } from "@/lib/email/email";
import {
  MAX_TEMPLATE_BLOCK_DEPTH,
  renderTemplateField,
} from "@/lib/email/render-template-field";
import { TEST_SEND_TEMPLATE_NAME } from "@/lib/email/reserved-event-types";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";

export { TEST_SEND_TEMPLATE_NAME };

/**
 * The request-path render bound, re-exported from where it now lives
 * (`lib/email/render-template-field.ts`) — US-015 gave the preview the same
 * need, so the guard moved and this stays the name test-send's callers know.
 */
export { MAX_TEMPLATE_BLOCK_DEPTH };

/**
 * 5 per minute, per tenant (AC-3). Fails CLOSED: this triggers a real outbound
 * send, so an unmetered flood during a Redis outage is worse than a brief
 * refusal — the same call the other mail-sending routes make.
 */
export const TEST_SEND_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60_000,
  failMode: "closed",
} as const;

/** Namespaced so a test send never shares a counter with another endpoint. */
export function testSendRateLimitKey(scope: string): string {
  return `email-test-send:${scope}`;
}

export interface TestSendTemplate {
  id: string;
  subject: string;
  contentHtml: string;
}

export interface QueueTestSendInput {
  template: TestSendTemplate;
  /** Event the template is mapped to, if any — selects the sample variable set. */
  eventType?: string | null;
  recipient: string;
  /** Tenant whose SMTP config sends it; "SYSTEM" for platform templates. */
  tenantId: string;
  businessName?: string | null;
}

/** Renders subject + body with sample variables and queues one message. */
export async function queueTestSend({
  template,
  eventType,
  recipient,
  tenantId,
  businessName,
}: QueueTestSendInput): Promise<{ subject: string }> {
  const variables = sampleVariablesForEvent(eventType, {
    businessName,
    email: recipient,
  });

  const subject = renderTemplateField(template.subject, variables);
  const html = renderTemplateField(template.contentHtml, variables);

  await sendEmail({
    to: recipient,
    subject,
    html,
    tenantId,
    templateName: TEST_SEND_TEMPLATE_NAME,
    variables,
    metadata: { testSend: true, templateId: template.id, eventType: eventType ?? null },
  });

  return { subject };
}
