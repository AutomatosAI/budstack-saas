/**
 * Announce a sub-processor change to every active operator.
 *
 * This is the mechanism behind DPA §6. Before it existed the promise was prose:
 * the page told operators to *subscribe* by emailing us, while the DPA said we
 * would notify them. Notice you have to opt into is not notice, and a controller
 * who never heard about a change cannot exercise the objection right they were
 * granted.
 *
 * Every active tenant is emailed. There is no subscriber list, deliberately.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-013).
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email/email";
import { createAuditLog } from "@/lib/audit-log";
import { OBJECTION_WINDOW_DAYS, hasSufficientNotice } from "./subprocessor-notice";

export interface AnnounceableSubprocessor {
  id: string;
  name: string;
  purpose: string;
  region: string;
  transferMechanism: string;
  effectiveFrom: Date;
}

export interface AnnounceResult {
  announced: number;
  failed: number;
  skipped: string[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The notice body.
 *
 * Written to be read by an operator, not a lawyer: what is changing, when it
 * starts, and what they can do about it. The objection deadline is stated as a
 * date rather than "14 days from announcement", because a reader should not
 * have to do arithmetic to find out how long they have.
 */
export function buildAnnouncementEmail(
  entry: AnnounceableSubprocessor,
  objectionDeadline: Date,
): { subject: string; html: string } {
  return {
    subject: `Change to BudStacks sub-processors: ${entry.name}`,
    html: `
      <p>Hello,</p>
      <p>
        We are writing to tell you in advance about a change to the vendors
        BudStacks uses to run your storefront. Under our Data Processing
        Agreement you are entitled to at least 30 days' notice of this, and to
        object.
      </p>
      <table cellpadding="6" style="border-collapse:collapse;margin:16px 0">
        <tr><td><strong>Vendor</strong></td><td>${entry.name}</td></tr>
        <tr><td><strong>What they do</strong></td><td>${entry.purpose}</td></tr>
        <tr><td><strong>Where</strong></td><td>${entry.region}</td></tr>
        <tr><td><strong>Transfer safeguard</strong></td><td>${entry.transferMechanism}</td></tr>
        <tr><td><strong>Starts</strong></td><td>${formatDate(entry.effectiveFrom)}</td></tr>
      </table>
      <p>
        If you object, do it by <strong>${formatDate(objectionDeadline)}</strong>.
        The quickest way is in your dashboard under
        <strong>Privacy Policy &rsaquo; Sub-processors</strong>, where the
        objection is recorded against this vendor and we can act on it. You can
        also reply to this email or write to
        <a href="mailto:legal@budstacks.io">legal@budstacks.io</a>.
      </p>
      <p>
        You do not need to do anything if you are content with the change. The
        full list is always at
        <a href="https://budstacks.io/legal/subprocessors">budstacks.io/legal/subprocessors</a>.
      </p>
      <p>— BudStacks</p>
    `.trim(),
  };
}

/**
 * Send the announcement and stamp `announcedAt`.
 *
 * Refuses to announce a change that does not carry the notice the DPA promises:
 * sending a "30 days' notice" email 5 days before the change is worse than not
 * sending one, because it creates a record of having complied.
 *
 * Individual send failures do not abort the run — one operator's bad address
 * must not stop the other ninety-nine being told. Failures are counted, logged
 * and surfaced by the caller.
 */
export async function announceSubprocessor(
  entryId: string,
  now = new Date(),
): Promise<AnnounceResult> {
  const entry = await prisma.subprocessors.findFirst({ where: { id: entryId } });
  if (!entry) throw new Error(`Sub-processor ${entryId} not found`);

  if (entry.announcedAt) {
    logger.warn("[Legal] Sub-processor already announced; not re-sending", {
      entryId,
      announcedAt: entry.announcedAt,
    });
    return { announced: 0, failed: 0, skipped: ["already-announced"] };
  }

  if (!hasSufficientNotice(now, entry.effectiveFrom)) {
    throw new Error(
      `Refusing to announce ${entry.name}: effective ${entry.effectiveFrom.toISOString()} ` +
        `does not give operators the notice the DPA promises. Move the date out.`,
    );
  }

  // Annotated because `prisma` is exported as `any`.
  interface NotifiableTenant {
    id: string;
    businessName: string;
    users: Array<{ email: string; role: string | null }>;
  }

  const tenants: NotifiableTenant[] = await prisma.tenants.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, businessName: true, users: { select: { email: true, role: true } } },
  });

  const objectionDeadline = new Date(
    now.getTime() + OBJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const { subject, html } = buildAnnouncementEmail(entry, objectionDeadline);

  let announced = 0;
  let failed = 0;

  for (const tenant of tenants) {
    const recipient = tenant.users.find((user) => user.role === "TENANT_ADMIN")?.email;
    if (!recipient) {
      failed++;
      logger.error("[Legal] No admin contact for tenant; sub-processor notice not sent", {
        tenantId: tenant.id,
        entryId,
      });
      continue;
    }

    try {
      await sendEmail({
        to: recipient,
        subject,
        html,
        tenantId: tenant.id,
        templateName: "subprocessor-change",
        metadata: { subprocessorId: entry.id, effectiveFrom: entry.effectiveFrom },
      });
      announced++;
    } catch (error) {
      failed++;
      logger.error("[Legal] Sub-processor notice failed to send", {
        tenantId: tenant.id,
        entryId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Stamped even when some sends failed: the objection window has started for
  // everyone who did receive it, and re-announcing would restart the clock for
  // them. Failures are surfaced so they can be chased individually.
  await prisma.subprocessors.update({
    where: { id: entry.id },
    data: { announcedAt: now, updatedAt: now },
  });

  await createAuditLog({
    action: "SUBPROCESSOR_ANNOUNCED",
    entityType: "subprocessor",
    entityId: entry.id,
    metadata: {
      name: entry.name,
      announced,
      failed,
      effectiveFrom: entry.effectiveFrom.toISOString(),
    },
  });

  logger.info("[Legal] Sub-processor change announced", {
    entryId,
    name: entry.name,
    announced,
    failed,
  });

  return { announced, failed, skipped: [] };
}

/**
 * Flip pending entries whose effective date has arrived.
 *
 * Unannounced entries are left alone by `shouldActivate` — processing must not
 * begin on a vendor operators were never told about, whatever the date says.
 */
export async function activateDueSubprocessors(now = new Date()): Promise<string[]> {
  const due: Array<{ id: string; name: string }> = await prisma.subprocessors.findMany({
    where: {
      status: "pending",
      announcedAt: { not: null },
      effectiveFrom: { lte: now },
    },
    select: { id: true, name: true },
  });

  for (const entry of due) {
    await prisma.subprocessors.update({
      where: { id: entry.id },
      data: { status: "active", updatedAt: now },
    });
    logger.info("[Legal] Sub-processor now in force", { entryId: entry.id, name: entry.name });
  }

  return due.map((entry) => entry.id);
}
