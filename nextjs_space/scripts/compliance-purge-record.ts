/**
 * Print the data-protection purge ledger.
 *
 * The counts a migration captured immediately before destroying data live in
 * `compliance_purge_records`. They are the evidence a purge happened and what it
 * cost — the thing a data protection reviewer actually asks for — but reading
 * them meant hand-writing SQL against production, which is why they sat
 * uncollected.
 *
 * Usage:
 *   npx tsx scripts/compliance-purge-record.ts
 *   npx tsx scripts/compliance-purge-record.ts --json
 *
 * Read-only. Touches nothing.
 *
 * See docs/compliance/2026-07-27-article9-purge.md
 */

import { PrismaClient } from "@prisma/client";

interface PurgeRecord {
  id: string;
  purgeName: string;
  executedAt: Date;
  details: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");
  const prisma = new PrismaClient();

  try {
    const records: PurgeRecord[] = await prisma.$queryRawUnsafe(
      `SELECT "id", "purgeName", "executedAt", "details"
       FROM "compliance_purge_records"
       ORDER BY "executedAt" DESC`,
    );

    if (records.length === 0) {
      console.log(
        "No purge records found.\n\n" +
          "If you expected one, the migration may not have run on this database. " +
          "Check that the deploy carrying 20260727000000_drop_article9_health_columns " +
          "completed against the environment you are pointed at (DATABASE_URL).",
      );
      return;
    }

    if (asJson) {
      console.log(JSON.stringify(records, null, 2));
      return;
    }

    for (const record of records) {
      console.log(`\n${"=".repeat(72)}`);
      console.log(record.purgeName);
      console.log(`${"=".repeat(72)}`);
      console.log(`id           ${record.id}`);
      console.log(`executed at  ${record.executedAt.toISOString()}`);
      console.log("");

      const details = record.details ?? {};
      const width = Math.max(...Object.keys(details).map((k) => k.length), 12);

      // Counts first — they are what gets pasted into the evidence record.
      for (const [key, value] of Object.entries(details)) {
        if (typeof value !== "string" || value.length <= 80) {
          console.log(`  ${key.padEnd(width)}  ${formatValue(value)}`);
        }
      }

      // Long prose (lawful-basis conclusions and the like) reads better after.
      for (const [key, value] of Object.entries(details)) {
        if (typeof value === "string" && value.length > 80) {
          console.log(`\n  ${key}:\n    ${value}`);
        }
      }
      console.log("");
    }

    console.log(
      `${"-".repeat(72)}\n` +
        "Paste these into docs/compliance/<record>.md §4 to close the evidence gap.\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to read the purge ledger:", error);
  process.exit(1);
});
