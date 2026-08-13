/**
 * US-028 — what the daily sweep actually does when it fires.
 *
 * SERVER ONLY, and written to be called from `scripts/email-worker.ts` without
 * dragging the worker's concerns in: it returns an outcome and prints nothing,
 * so the worker stays the only place that decides what appears in the logs, and
 * this stays testable without booting a queue — the shape
 * `campaign-scheduled-runner.ts` established.
 *
 * Everything runs inside `bypassTenantScope`, which binds an EXPLICIT null
 * context. The worker has no request context, and every query underneath names
 * its tenantId itself, so this stays legal under TENANT_CONTEXT_STRICT.
 *
 * ONE MESSAGE PER PERSON, and each one is claimed before it is queued. The claim
 * is the reason a second sweep — another worker, a manual run overlapping the
 * scheduled one — mails nobody twice.
 */

import { prisma } from "@/lib/db";
import { loadEmailShellTenant } from "@/lib/email/email-shell-tenant";
import type { EmailShellTenant } from "@/lib/email/email-shell";
import { renderEmailTemplate } from "@/lib/email/handlebars-helpers";
import { buildNewsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";
import {
  REORDER_REMINDER_SUBJECT,
  reorderCutoff,
  resolveReorderReminderRule,
} from "@/lib/email/reorder-reminder";
import {
  renderReorderReminderHtml,
  reorderReminderVariables,
} from "@/lib/email/reorder-reminder-content";
import {
  claimReorderReminder,
  enqueueReorderReminder,
  findReorderCandidates,
  reorderRatePerMinute,
} from "@/lib/email/reorder-reminder-store";
import { bypassTenantScope } from "@/lib/tenant/tenant-scope-policy";

/** What one store's pass produced. */
export interface ReorderTenantOutcome {
  readonly tenantId: string;
  /** Customers the rule matched, before the claim. */
  readonly due: number;
  /** Messages actually queued — one per person claimed. */
  readonly queued: number;
  /** Matched but claimed by another sweep first. */
  readonly skipped: number;
  /**
   * Left for tomorrow because this store hit REORDER_MAX_PER_SWEEP. Reported
   * rather than swallowed: a truncated sweep that said nothing would read as a
   * finished one.
   */
  readonly deferred: boolean;
  /**
   * Why this store's pass stopped early, or null when it ran to the end.
   *
   * A store that threw is the ONE outcome that must not look like a store with
   * nobody due — both queue zero messages, and only this field tells them
   * apart.
   */
  readonly error: string | null;
}

export interface ReorderSweepOutcome {
  /** Stores with the automation switched on. */
  readonly tenants: number;
  readonly queued: number;
  readonly perTenant: readonly ReorderTenantOutcome[];
}

const NOTHING: ReorderTenantOutcome = {
  tenantId: "",
  due: 0,
  queued: 0,
  skipped: 0,
  deferred: false,
  error: null,
};

/** Stores with the automation on, and the window each of them asked for. */
async function enabledTenants(): Promise<
  { tenantId: string; days: number }[]
> {
  const rows: { id: string; settings: unknown }[] =
    await prisma.tenants.findMany({
      where: { isActive: true },
      select: { id: true, settings: true },
    });

  return rows
    .map((row) => ({
      tenantId: row.id,
      rule: resolveReorderReminderRule(row.settings, row.id),
    }))
    .filter((entry) => entry.rule.enabled)
    .map((entry) => ({ tenantId: entry.tenantId, days: entry.rule.days }));
}

/**
 * Queue one store's reminders.
 *
 * The branded body is rendered ONCE and filled per recipient, not re-rendered
 * per person: the only per-person value in it is `{{unsubscribeUrl}}`, and
 * running react-email plus juice plus the sanitizer for every customer to
 * substitute one string would be the expensive way to reach the same document.
 *
 * The claim comes BEFORE the enqueue. The other order — queue, then record —
 * loses a crash between the two as a second reminder on the next sweep, and
 * mailing somebody twice is the failure this automation must not have. A crash
 * in this order costs at most one reminder that was recorded and never sent,
 * which the customer never sees.
 */
export async function runTenantReorderReminders(
  tenantId: string,
  days: number,
  now: Date,
): Promise<ReorderTenantOutcome> {
  const cutoff = reorderCutoff(now, days);
  const { candidates, atCap } = await findReorderCandidates(tenantId, cutoff);
  if (candidates.length === 0) {
    return { ...NOTHING, tenantId, deferred: atCap };
  }

  const tenant: EmailShellTenant | null = await loadEmailShellTenant(tenantId);
  // The store was deleted between the settings read and here. Nothing to brand
  // the message with and nowhere for its unsubscribe link to resolve.
  if (!tenant) {
    return { ...NOTHING, tenantId, due: candidates.length, deferred: atCap };
  }

  const bodyHtml = await renderReorderReminderHtml(tenant);
  const ratePerMinute = reorderRatePerMinute();

  let queued = 0;
  for (const candidate of candidates) {
    const claim = await claimReorderReminder(candidate, tenantId, cutoff, now);
    if (!claim.claimed) continue;

    const variables = reorderReminderVariables({
      tenant,
      email: candidate.email,
      name: candidate.name,
      unsubscribeUrl: buildNewsletterUnsubscribeUrl(tenant, claim.token),
    });

    await enqueueReorderReminder({
      tenantId,
      email: candidate.email,
      subject: renderEmailTemplate(REORDER_REMINDER_SUBJECT, variables),
      // Filled here rather than left as a slot: the worker only compiles the
      // payload's `html` when an event mapping replaced it, so a body queued
      // with `{{unsubscribeUrl}}` still in it would ship the literal text — and
      // US-020 would (correctly) refuse to send it.
      html: renderEmailTemplate(bodyHtml, variables),
      variables,
      index: queued,
      ratePerMinute,
    });
    queued += 1;
  }

  return {
    tenantId,
    due: candidates.length,
    queued,
    skipped: candidates.length - queued,
    deferred: atCap,
    error: null,
  };
}

/**
 * The whole sweep: every store that asked for it, one after another.
 *
 * SERIAL on purpose. Each store's pass is an unbounded customer read followed by
 * one write and one enqueue per person, and running every store's at once would
 * make the daily automation the heaviest thing on the connection pool the
 * storefront shares.
 *
 * ONE STORE'S FAILURE DOES NOT STOP THE REST, and the catch is what makes that
 * true. `enabledTenants` imposes no order, so an exception escaping this loop
 * would silently cost every store that happened to sort after the broken one
 * its reminders for the day — and a store that failed would be indistinguishable
 * from a store with nobody due, since both queue nothing. The failure is
 * recorded on that store's own outcome instead, where the worker prints it.
 *
 * Nothing is rethrown: the queue is configured `attempts: 1` precisely so a
 * half-finished sweep is not re-run, which makes failing the whole job over one
 * store pure loss. The customers missed are still inside their window tomorrow.
 */
export async function runReorderReminderSweep(
  now: Date = new Date(),
): Promise<ReorderSweepOutcome> {
  return bypassTenantScope(async () => {
    const tenants = await enabledTenants();
    const perTenant: ReorderTenantOutcome[] = [];

    for (const { tenantId, days } of tenants) {
      try {
        perTenant.push(await runTenantReorderReminders(tenantId, days, now));
      } catch (cause) {
        perTenant.push({
          ...NOTHING,
          tenantId,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }

    return {
      tenants: tenants.length,
      queued: perTenant.reduce((total, outcome) => total + outcome.queued, 0),
      perTenant,
    };
  });
}
