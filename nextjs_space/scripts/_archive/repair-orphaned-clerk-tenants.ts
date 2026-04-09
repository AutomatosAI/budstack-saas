/**
 * Repair script for orphaned Clerk tenants.
 *
 * When onboarding fails after Clerk records are created but before DB records
 * are written (e.g., database unreachable), this script creates the missing
 * DB records to match the existing Clerk user + org.
 *
 * Usage: npx tsx scripts/repair-orphaned-clerk-tenants.ts
 * On Railway: railway run npx tsx scripts/repair-orphaned-clerk-tenants.ts
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';

const prisma = new PrismaClient();

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

async function repairOrphanedTenants() {
  console.log('Scanning Clerk organizations for orphaned tenants...\n');

  // Get all Clerk organizations
  const orgs = await clerk.organizations.getOrganizationList({ limit: 100 });

  for (const org of orgs.data) {
    const orgSlug = org.slug;
    const orgName = org.name;
    const clerkOrgId = org.id;

    // Check if this org already has a matching DB tenant
    const existingTenant = await prisma.tenants.findUnique({
      where: { subdomain: orgSlug! },
    });

    if (existingTenant) {
      console.log(`OK: "${orgName}" (${orgSlug}) — DB tenant exists`);
      continue;
    }

    console.log(`\nORPHANED: "${orgName}" (${orgSlug}) — no DB tenant found`);
    console.log(`  Clerk Org ID: ${clerkOrgId}`);

    // Get the org's admin members
    const members = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
    });

    const adminMember = members.data.find(
      (m) => m.role === 'org:admin' || m.role === 'admin'
    );

    if (!adminMember) {
      console.log(`  WARNING: No admin member found, skipping`);
      continue;
    }

    const clerkUserId = adminMember.publicUserData?.userId;
    if (!clerkUserId) {
      console.log(`  WARNING: Admin member has no userId, skipping`);
      continue;
    }

    const clerkUser = await clerk.users.getUser(clerkUserId);
    const adminEmail = clerkUser.emailAddresses[0]?.emailAddress;
    const adminName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || orgName;

    console.log(`  Admin: ${adminEmail} (${adminName})`);

    // Check if user already exists in DB
    const existingUser = await prisma.users.findFirst({
      where: { email: adminEmail },
    });

    if (existingUser?.tenantId) {
      console.log(`  WARNING: User ${adminEmail} already has tenant ${existingUser.tenantId}, skipping`);
      continue;
    }

    // Get country code from org metadata
    const countryCode = (org.publicMetadata as any)?.countryCode || 'PT';
    const nftTokenId = (org.publicMetadata as any)?.nftTokenId || 'REPAIR_GENERATED';

    // Find or create the template
    // Try to match by slug (org slug often matches template slug)
    let dbTemplate = await prisma.templates.findFirst({
      where: { slug: orgSlug! },
    });

    // Fallback to healingbuds
    if (!dbTemplate) {
      dbTemplate = await prisma.templates.findFirst({
        where: { slug: 'healingbuds' },
      });
    }

    if (!dbTemplate) {
      console.log(`  ERROR: No template found (not even healingbuds fallback), skipping`);
      continue;
    }

    console.log(`  Template: ${dbTemplate.name} (${dbTemplate.slug})`);
    console.log(`  Creating DB records...`);

    // Create tenant
    const tenantId = crypto.randomUUID();
    const tenant = await prisma.tenants.create({
      data: {
        id: tenantId,
        businessName: orgName,
        subdomain: orgSlug!,
        nftTokenId,
        countryCode,
        isActive: true,
        templateId: dbTemplate.id,
        updatedAt: new Date(),
        settings: {
          clerkOrgId,
          templatePreset: dbTemplate.slug,
          repairedAt: new Date().toISOString(),
        },
      },
    });
    console.log(`  + Tenant created: ${tenant.id}`);

    // Create tenant branding
    await prisma.tenant_branding.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        primaryColor: '#10b981',
        secondaryColor: '#059669',
        accentColor: '#34d399',
        fontFamily: 'Inter',
        updatedAt: new Date(),
      },
    });
    console.log(`  + Tenant branding created`);

    // Create tenant_templates record
    const tenantTemplateId = crypto.randomUUID();
    await prisma.tenant_templates.create({
      data: {
        id: tenantTemplateId,
        tenantId: tenant.id,
        baseTemplateId: dbTemplate.id,
        templateName: dbTemplate.name,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log(`  + Tenant template created`);

    // Set active template
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: { activeTenantTemplateId: tenantTemplateId },
    });
    console.log(`  + Active template set`);

    // Create or update user
    await prisma.users.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        role: 'TENANT_ADMIN',
        tenantId: tenant.id,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        email: adminEmail,
        password: 'CLERK_MANAGED_ACCOUNT',
        name: adminName,
        role: 'TENANT_ADMIN',
        tenantId: tenant.id,
        updatedAt: new Date(),
      },
    });
    console.log(`  + User linked to tenant`);

    console.log(`  REPAIRED: "${orgName}" is now fully set up\n`);
  }

  console.log('\nDone.');
}

repairOrphanedTenants()
  .catch((error) => {
    console.error('Repair failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
