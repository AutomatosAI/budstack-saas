/**
 * Read-only diagnostic: cross-checks every user's stored drGreenClientId against
 * the real client ID returned by Dr Green's email lookup.
 *
 * Usage:
 *   npx tsx scripts/audit-drgreen-client-ids.ts                        # all tenants
 *   npx tsx scripts/audit-drgreen-client-ids.ts --tenant=<subdomain>   # single tenant
 *   npx tsx scripts/audit-drgreen-client-ids.ts --csv                  # CSV output
 *
 * No writes, no side effects. Only reads user rows and calls Dr Green API.
 */

import { PrismaClient } from '@prisma/client';
import { getTenantDrGreenConfig } from '../lib/tenant/tenant-config';
import { fetchClient, fetchClientByEmail } from '../lib/drgreen/doctor-green-api';

const prisma = new PrismaClient();

type Row = {
  tenant: string;
  userId: string;
  email: string;
  storedId: string;
  storedIdResolves: 'ok' | 'fail';
  emailLookupId: string | null;
  status: 'OK' | 'MISMATCH' | 'STORED_MISSING_FROM_DRGREEN' | 'EMAIL_NOT_FOUND' | 'ERROR';
  note?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  return {
    tenant: tenantArg ? tenantArg.split('=')[1] : null,
    csv: args.includes('--csv'),
  };
}

async function auditTenant(
  tenantId: string,
  subdomain: string,
): Promise<Row[]> {
  const rows: Row[] = [];

  let config;
  try {
    config = await getTenantDrGreenConfig(tenantId);
  } catch (e) {
    console.error(
      `[${subdomain}] Skipping — could not load Dr Green config:`,
      e instanceof Error ? e.message : e,
    );
    return rows;
  }

  const users = await prisma.users.findMany({
    where: {
      tenantId,
      drGreenClientId: { not: null },
    },
    select: { id: true, email: true, drGreenClientId: true },
  });

  console.log(
    `[${subdomain}] Auditing ${users.length} users with stored drGreenClientId`,
  );

  for (const user of users) {
    const storedId = user.drGreenClientId!;
    const email = user.email;
    let storedOk = false;
    let emailLookupId: string | null = null;
    let note: string | undefined;

    try {
      const c = await fetchClient(storedId, config);
      if (c?.id) storedOk = true;
    } catch (e) {
      note = `fetchClient err: ${
        e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)
      }`;
    }

    try {
      const byEmail = await fetchClientByEmail(email, config);
      emailLookupId = byEmail?.id || null;
    } catch (e) {
      note =
        (note ? note + ' | ' : '') +
        `byEmail err: ${
          e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80)
        }`;
    }

    let status: Row['status'];
    if (!emailLookupId && !storedOk) status = 'EMAIL_NOT_FOUND';
    else if (!emailLookupId && storedOk) status = 'OK'; // email list didn't reach them in pagination window, but ID is valid
    else if (storedOk && emailLookupId === storedId) status = 'OK';
    else if (!storedOk && emailLookupId) status = 'STORED_MISSING_FROM_DRGREEN';
    else if (storedOk && emailLookupId && emailLookupId !== storedId) status = 'MISMATCH';
    else status = 'ERROR';

    rows.push({
      tenant: subdomain,
      userId: user.id,
      email,
      storedId,
      storedIdResolves: storedOk ? 'ok' : 'fail',
      emailLookupId,
      status,
      note,
    });
  }

  return rows;
}

async function main() {
  const { tenant, csv } = parseArgs();

  const tenants = await prisma.tenants.findMany({
    where: tenant ? { subdomain: tenant } : {},
    select: { id: true, subdomain: true },
  });

  if (tenants.length === 0) {
    console.error(`No tenants found${tenant ? ` matching "${tenant}"` : ''}`);
    return;
  }

  const allRows: Row[] = [];
  for (const t of tenants) {
    const rows = await auditTenant(t.id, t.subdomain);
    allRows.push(...rows);
  }

  if (csv) {
    console.log(
      'tenant,userId,email,storedId,storedIdResolves,emailLookupId,status,note',
    );
    for (const r of allRows) {
      console.log(
        [
          r.tenant,
          r.userId,
          r.email,
          r.storedId,
          r.storedIdResolves,
          r.emailLookupId ?? '',
          r.status,
          (r.note ?? '').replace(/,/g, ';'),
        ].join(','),
      );
    }
  } else {
    const buckets: Record<string, Row[]> = {};
    for (const r of allRows) {
      (buckets[r.status] ||= []).push(r);
    }

    console.log('\n=== SUMMARY ===');
    for (const [status, rows] of Object.entries(buckets)) {
      console.log(`${status}: ${rows.length}`);
    }

    const bad = allRows.filter(
      (r) => r.status !== 'OK' && r.status !== 'EMAIL_NOT_FOUND',
    );
    if (bad.length) {
      console.log('\n=== MISMATCHED / BROKEN ROWS ===');
      for (const r of bad) {
        console.log(
          `[${r.tenant}] ${r.email}  stored=${r.storedId} (${r.storedIdResolves})  real=${r.emailLookupId ?? 'n/a'}  -> ${r.status}${r.note ? '  // ' + r.note : ''}`,
        );
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
