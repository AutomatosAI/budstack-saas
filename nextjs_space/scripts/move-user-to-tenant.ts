/**
 * Move a user (and their KYC-relevant records) from whatever tenant they
 * live under today to a target tenant. Written for the case where a KYC-
 * verified customer from one flagship store (e.g. HealingBuds) needs to
 * shop on another (e.g. Lekkerweed) without re-doing Dr Green verification.
 *
 * Moves:
 *   - users.tenantId
 *   - consultation_questionnaires rows matching the email
 *   - consultations rows owned by the user
 *   - kyc_journey_logs rows owned by the user
 *
 * Does NOT move:
 *   - orders / order_items / drgreen_carts — those stay under their original
 *     tenant so historical attribution is preserved.
 *
 * Usage:
 *   npx tsx scripts/move-user-to-tenant.ts --email=user@x.com --to-tenant=lekkerweed               # dry run
 *   npx tsx scripts/move-user-to-tenant.ts --email=user@x.com --to-tenant=lekkerweed --apply       # write
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split('=').slice(1).join('=') : undefined;
  };
  return {
    email: get('email'),
    toTenant: get('to-tenant'),
    apply: args.includes('--apply'),
  };
}

async function main() {
  const { email, toTenant, apply } = parseArgs();
  if (!email || !toTenant) {
    console.error('Usage: --email=<email> --to-tenant=<subdomain> [--apply]');
    process.exit(1);
  }

  const tenant = await prisma.tenants.findFirst({
    where: { subdomain: toTenant, isActive: true },
    select: { id: true, subdomain: true, name: true },
  });
  if (!tenant) {
    console.error(`Target tenant not found for subdomain=${toTenant}`);
    process.exit(1);
  }

  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, tenantId: true, drGreenClientId: true },
  });
  if (!user) {
    console.error(`No user row for email=${email}`);
    process.exit(1);
  }

  const questionnaires = await prisma.consultation_questionnaires.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, tenantId: true, isKycVerified: true, adminApproval: true, drGreenClientId: true },
  });
  const consultationsCount = await prisma.consultations.count({ where: { userId: user.id } });
  const kycLogsCount = await prisma.kyc_journey_logs.count({
    where: {
      OR: [
        { email: { equals: email, mode: 'insensitive' } },
        ...(user.drGreenClientId ? [{ clientId: user.drGreenClientId }] : []),
      ],
    },
  });

  console.log('\n=== Current state ===');
  console.log('Target tenant:', tenant);
  console.log('User:', user);
  console.log('Questionnaires:', questionnaires);
  console.log('Consultations count:', consultationsCount);
  console.log('KYC journey logs count:', kycLogsCount);

  if (!apply) {
    console.log('\n(dry-run) add --apply to actually move records');
    return;
  }

  const result = await prisma.$transaction([
    prisma.users.update({
      where: { id: user.id },
      data: { tenantId: tenant.id },
    }),
    prisma.consultation_questionnaires.updateMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      data: { tenantId: tenant.id },
    }),
    prisma.consultations.updateMany({
      where: { userId: user.id },
      data: { tenantId: tenant.id },
    }),
    prisma.kyc_journey_logs.updateMany({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          ...(user.drGreenClientId ? [{ clientId: user.drGreenClientId }] : []),
        ],
      },
      data: { tenantId: tenant.id },
    }),
  ]);

  console.log('\n=== Applied ===');
  console.log('users updated:', 1);
  console.log('questionnaires updated:', result[1].count);
  console.log('consultations updated:', result[2].count);
  console.log('kyc_journey_logs updated:', result[3].count);
  console.log('\nDone. Mayke (or whichever user) should now see the KYC cache hit on the new tenant.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
