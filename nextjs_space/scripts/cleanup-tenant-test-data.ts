/**
 * Cleanup test data for a SINGLE tenant. DRY-RUN by default — reports scope and
 * changes nothing unless you pass --apply.
 *
 * Deletes:
 *   - ALL orders for the tenant (order_items cascade via onDelete: Cascade)
 *   - PATIENT users created BEFORE the cutoff (their child rows cascade)
 *   - consultation questionnaires created BEFORE the cutoff (tenant-scoped)
 * KEEPS:
 *   - PATIENT users created ON/AFTER the cutoff (the "new users since yesterday")
 *
 * Runs against whatever DATABASE_URL is in the environment, so run it through
 * the governed prod path (e.g. `railway run`) — NOT with a hand-typed prod URL.
 * A raw PrismaClient is used on purpose: no tenant-scope extension (this is a
 * cross-tenant admin op) and no "@/..." path aliases (which tsx can't resolve).
 *
 * Usage (from nextjs_space/):
 *   railway run tsx scripts/cleanup-tenant-test-data.ts --tenant "CannExert"
 *   railway run tsx scripts/cleanup-tenant-test-data.ts --tenant "CannExert" --apply
 *   # optional cutoff (default 2026-07-09): --before 2026-07-09
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const tenantQuery = getArg("--tenant");
  const apply = process.argv.includes("--apply");
  const beforeStr = getArg("--before") || "2026-07-09";
  const before = new Date(`${beforeStr}T00:00:00.000Z`);

  if (!tenantQuery) {
    console.error('ERROR: --tenant "<businessName or subdomain>" is required');
    process.exit(1);
  }
  if (Number.isNaN(before.getTime())) {
    console.error(`ERROR: invalid --before date: ${beforeStr}`);
    process.exit(1);
  }

  // Resolve the tenant. Refuse to proceed on 0 or >1 matches so we never
  // touch the wrong tenant's data.
  const matches = await prisma.tenants.findMany({
    where: {
      OR: [
        { businessName: { equals: tenantQuery, mode: "insensitive" } },
        { businessName: { contains: tenantQuery, mode: "insensitive" } },
        { subdomain: { equals: tenantQuery, mode: "insensitive" } },
      ],
    },
    select: { id: true, businessName: true, subdomain: true },
  });

  if (matches.length === 0) {
    console.error(`No tenant matched "${tenantQuery}".`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Ambiguous — ${matches.length} tenants matched "${tenantQuery}":`);
    matches.forEach((t) =>
      console.error(`  - ${t.businessName} (${t.subdomain}) [${t.id}]`),
    );
    console.error("Re-run with the exact subdomain.");
    process.exit(1);
  }

  const tenant = matches[0];
  const tenantId = tenant.id;
  console.log(`Tenant : ${tenant.businessName} (${tenant.subdomain}) [${tenantId}]`);
  console.log(
    `Cutoff : PATIENT users created BEFORE ${before.toISOString()} are treated as test (deleted); ON/AFTER are kept.`,
  );

  const [orderCount, orderAgg, testUsers, keptUsers, testQuestionnaires] =
    await Promise.all([
      prisma.orders.count({ where: { tenantId } }),
      prisma.orders.aggregate({ where: { tenantId }, _sum: { total: true } }),
      prisma.users.count({
        where: { tenantId, role: "PATIENT", createdAt: { lt: before } },
      }),
      prisma.users.count({
        where: { tenantId, role: "PATIENT", createdAt: { gte: before } },
      }),
      prisma.consultation_questionnaires.count({
        where: { tenantId, createdAt: { lt: before } },
      }),
    ]);

  console.log("\n--- SCOPE ---");
  console.log(
    `Orders to delete (ALL for tenant)        : ${orderCount}  (total value ${orderAgg._sum.total ?? 0})`,
  );
  console.log(`PATIENT users to delete (< cutoff)       : ${testUsers}`);
  console.log(`PATIENT users to KEEP  (>= cutoff)       : ${keptUsers}`);
  console.log(`Questionnaires to delete (< cutoff)      : ${testQuestionnaires}`);

  if (!apply) {
    console.log("\nDRY RUN — nothing changed. Re-run with --apply to execute.");
    return;
  }

  console.log("\n--apply — deleting inside a transaction...");
  const result = await prisma.$transaction(async (tx) => {
    const orders = await tx.orders.deleteMany({ where: { tenantId } });
    const questionnaires = await tx.consultation_questionnaires.deleteMany({
      where: { tenantId, createdAt: { lt: before } },
    });
    const users = await tx.users.deleteMany({
      where: { tenantId, role: "PATIENT", createdAt: { lt: before } },
    });
    return { orders, questionnaires, users };
  });

  console.log(`Deleted orders          : ${result.orders.count}`);
  console.log(`Deleted questionnaires  : ${result.questionnaires.count}`);
  console.log(`Deleted PATIENT users   : ${result.users.count}`);
  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
