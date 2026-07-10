/**
 * PRD-220 AC-A4 — one-off drain for the pre-worker email backlog.
 *
 * The worker's expiry guard handles jobs that still exist in Redis. This
 * script catches the rest: email_logs rows stuck QUEUED whose Redis job is
 * gone (Redis restart, eviction, or the pre-worker era), so counters and the
 * stuck-queue alert start from a clean slate.
 *
 * Dry-run by default; nothing is written without --apply.
 *
 * Usage (Railway one-off or locally with prod DATABASE_URL):
 *   npx tsx scripts/expire-stale-queued-email-logs.ts          # report only
 *   npx tsx scripts/expire-stale-queued-email-logs.ts --apply  # mark FAILED
 */
import { prisma } from "../lib/db";
import { DEFAULT_MAX_JOB_AGE_MS, msFromEnv } from "../lib/email/worker-health";

async function main() {
  const apply = process.argv.includes("--apply");
  const maxJobAgeMs = msFromEnv(process.env.EMAIL_MAX_JOB_AGE_MS, DEFAULT_MAX_JOB_AGE_MS);
  const cutoff = new Date(Date.now() - maxJobAgeMs);
  const where = { status: "QUEUED", createdAt: { lt: cutoff } };

  const count = await prisma.email_logs.count({ where });
  console.log(
    `[expire-stale-email-logs] ${count} QUEUED email_logs older than ${cutoff.toISOString()}` +
      (apply ? "" : " — DRY RUN (pass --apply to mark them FAILED)"),
  );

  if (apply && count > 0) {
    const result = await prisma.email_logs.updateMany({
      where,
      data: {
        status: "FAILED",
        errorMessage: `Expired unsent (PRD-220 drain): queued before ${cutoff.toISOString()} while no worker was running`,
      },
    });
    console.log(`[expire-stale-email-logs] marked ${result.count} rows FAILED`);
  }
}

main()
  .catch((error) => {
    console.error("[expire-stale-email-logs] failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect?.());
