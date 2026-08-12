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
import { ApiError } from "@/lib/api-error";
import { sendEmail } from "@/lib/email/email";
import {
  maxBlockDepth,
  renderEmailTemplate,
} from "@/lib/email/handlebars-helpers";
import { TEST_SEND_TEMPLATE_NAME } from "@/lib/email/reserved-event-types";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";

export { TEST_SEND_TEMPLATE_NAME };

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

/**
 * Deeper than any real email layout, shallow enough that the exponential
 * blow-up stays bounded on the request path.
 */
export const MAX_TEMPLATE_BLOCK_DEPTH = 10;

/**
 * Render one field, refusing pathological or malformed templates as 400s. The
 * caller authored this template, so echoing the Handlebars parse error back is
 * useful rather than a leak — capped, because it quotes their own source.
 */
function renderField(source: string, variables: Record<string, unknown>): string {
  if (maxBlockDepth(source) > MAX_TEMPLATE_BLOCK_DEPTH) {
    throw new ApiError(
      `This template nests {{#…}} blocks more than ${MAX_TEMPLATE_BLOCK_DEPTH} deep — simplify it before sending a test.`,
      400,
    );
  }

  try {
    return renderEmailTemplate(source, variables);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new ApiError(
      `This template could not be rendered — ${detail.slice(0, 200)}`,
      400,
    );
  }
}

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

  const subject = renderField(template.subject, variables);
  const html = renderField(template.contentHtml, variables);

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
