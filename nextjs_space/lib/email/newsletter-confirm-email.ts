/**
 * Enqueues the double opt-in message (US-003).
 *
 * Server-only: pulls in react-email rendering and the BullMQ-backed
 * MailerService. The link, the notice copy and the decision logic are in the
 * client-safe `lib/email/newsletter-confirm.ts`.
 *
 * Must be called inside the subscriber's bound tenant context — sendEmail
 * writes a QUEUED `email_logs` row, and `email_logs` is tenant-scoped, so an
 * unbound call throws under TENANT_CONTEXT_STRICT.
 */

import { emailTemplates, sendEmail } from "@/lib/email/email";
import {
  NEWSLETTER_CONFIRM_TEMPLATE,
  buildNewsletterConfirmUrl,
} from "@/lib/email/newsletter-confirm";

export interface ConfirmationTenant {
  readonly id: string;
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
}

export interface SendConfirmationInput {
  readonly tenant: ConfirmationTenant;
  readonly email: string;
  readonly token: string;
}

export function newsletterConfirmSubject(businessName: string): string {
  return `Confirm your subscription to ${businessName}`;
}

/**
 * The rendered HTML is the fallback the worker sends when no `newsletterConfirm`
 * event mapping is active; when one is, the worker recompiles the mapped
 * template against `variables` instead. Both paths need the same confirm link,
 * so it is passed through both.
 *
 * No logo is passed: tenant logos are still presigned S3 URLs that expire in an
 * hour (US-005 makes them durable), and a broken image in the one email that
 * has to be trusted is worse than no image.
 */
export async function sendNewsletterConfirmation({
  tenant,
  email,
  token,
}: SendConfirmationInput): Promise<void> {
  const confirmUrl = buildNewsletterConfirmUrl(tenant, token);
  const html = await emailTemplates.newsletterConfirm(
    confirmUrl,
    tenant.businessName,
  );

  await sendEmail({
    to: email,
    subject: newsletterConfirmSubject(tenant.businessName),
    html,
    tenantId: tenant.id,
    templateName: NEWSLETTER_CONFIRM_TEMPLATE,
    variables: { confirmUrl, businessName: tenant.businessName },
  });
}
