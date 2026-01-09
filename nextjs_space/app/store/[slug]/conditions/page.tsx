import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant';
import { prisma } from '@/lib/db';
import ConditionsClient from './conditions-client';

export default async function ConditionsPage({ params }: { params: { slug: string } }) {
  const tenant = await getTenantBySlug(params.slug);

  if (!tenant) {
    notFound();
  }

  // 1. Get the master tenant (healingbuds) to fetch shared conditions
  const masterTenant = await prisma.tenants.findUnique({
    where: { subdomain: 'healingbuds' },
    select: { id: true }
  });

  const tenantIdsToFetch = [tenant.id];
  if (masterTenant && masterTenant.id !== tenant.id) {
    tenantIdsToFetch.push(masterTenant.id);
  }

  // Fetch conditions from DB
  const allConditions = await prisma.conditions.findMany({
    where: {
      tenantId: { in: tenantIdsToFetch },
      published: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Deduplicate: if slug exists for both, keep the one from current tenant (tenant.id)
  const conditionMap = new Map();

  // Process master tenant conditions first (so they can be overwritten)
  if (masterTenant) {
    allConditions
      .filter((c: any) => c.tenantId === masterTenant.id)
      .forEach((c: any) => conditionMap.set(c.slug, c));
  }

  // Process current tenant conditions (overwriting master)
  allConditions
    .filter((c: any) => c.tenantId === tenant.id)
    .forEach((c: any) => conditionMap.set(c.slug, c));

  const uniqueConditions = Array.from(conditionMap.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));

  return <ConditionsClient tenant={tenant} conditions={uniqueConditions} />;
}
