import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getNamecheapClient } from "@/lib/namecheap-api";
import { addCustomDomain, removeCustomDomain } from "@/lib/railway-api";
import { clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";

export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: params.id },
      include: {
        users: {
          where: { role: "TENANT_ADMIN" },
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
          },
        },
        branding: true,
        template: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            users: true,
            products: true,
            orders: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

export const PATCH = withSuperAdminParams(async (req, { user }, params) => {
  try {
    const body = await req.json();
    const {
      isActive,
      namecheapUsername,
      businessName,
      subdomain,
      customDomain,
      countryCode,
      settings,
    } = body;

    // Get tenant before update
    const existingTenant = await prisma.tenants.findUnique({
      where: { id: params.id },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check if subdomain is being changed and if it's unique
    if (subdomain && subdomain !== existingTenant.subdomain) {
      const subdomainExists = await prisma.tenants.findUnique({
        where: { subdomain },
      });

      if (subdomainExists) {
        return NextResponse.json(
          { error: "Subdomain already exists" },
          { status: 400 },
        );
      }
    }

    // Check if custom domain is being changed and if it's unique
    if (customDomain && customDomain !== existingTenant.customDomain) {
      // tenant-gate:allow(uniqueness) — PRD-205 AC-2b: super-admin custom-domain-availability
      // check, NOT request tenant resolution. Spans all tenants (incl. inactive) excluding
      // self, which the isActive-scoped canonical resolveTenant cannot express.
      const domainExists = await prisma.tenants.findFirst({
        where: {
          customDomain,
          id: { not: params.id },
        },
      });

      if (domainExists) {
        return NextResponse.json(
          { error: "Custom domain already exists" },
          { status: 400 },
        );
      }
    }

    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io';

    // If activating a tenant for the first time, create subdomain via Namecheap API
    if (isActive && !existingTenant.isActive && namecheapUsername) {
      try {
        const namecheap = getNamecheapClient(namecheapUsername);
        const subdomainCreated = await namecheap.createTenantSubdomain(
          existingTenant.subdomain,
        );

        if (!subdomainCreated) {
          return NextResponse.json(
            {
              error:
                "Failed to create subdomain via Namecheap API. Please try again or create manually.",
              details: "Namecheap API call failed",
            },
            { status: 500 },
          );
        }

        console.log(
          `✅ Created subdomain: ${existingTenant.subdomain}.${baseDomain}`,
        );
      } catch (error) {
        console.error("Namecheap API error:", error);
        return NextResponse.json(
          {
            error:
              "Failed to create subdomain. Please check Namecheap API credentials and whitelisted IP.",
          },
          { status: 500 },
        );
      }
    }

    // If deactivating, optionally delete the subdomain
    if (
      isActive !== undefined &&
      !isActive &&
      existingTenant.isActive &&
      namecheapUsername
    ) {
      try {
        const namecheap = getNamecheapClient(namecheapUsername);
        await namecheap.deleteTenantSubdomain(existingTenant.subdomain);
        console.log(
          `🗑️ Deleted subdomain: ${existingTenant.subdomain}.${baseDomain}`,
        );
      } catch (error) {
        console.error("Error deleting subdomain:", error);
        // Don't fail the whole request if subdomain deletion fails
      }
    }

    // Custom domain provisioning (Railway only — Clerk uses proxy mode via /__clerk rewrite)
    const existingSettings = (existingTenant.settings as Record<string, unknown>) || {};
    let railwayDomainId = (existingSettings.railwayDomainId as string) || null;
    let railwayDnsRecords: Array<{ hostlabel: string; requiredValue: string; status: string }> | null = (existingSettings.railwayDnsRecords as Array<{ hostlabel: string; requiredValue: string; status: string }>) || null;
    let domainVerification = existingSettings.domainVerification ?? null;

    const domainChanged =
      customDomain !== undefined && customDomain !== existingTenant.customDomain;
    // Recovery: domain saved (e.g. via tenant-admin settings) but never provisioned on Railway
    const resolvedDomain = customDomain ?? existingTenant.customDomain;
    const needsRecoveryProvisioning =
      !domainChanged && !!resolvedDomain && !railwayDomainId;

    if (domainChanged) {
      // Remove old domain from Railway if one was provisioned
      if (existingTenant.customDomain && railwayDomainId) {
        try {
          await removeCustomDomain(railwayDomainId);
          console.log(`🗑️ Removed Railway domain: ${existingTenant.customDomain}`);
        } catch (error) {
          console.error("Railway domain removal error:", error);
        }
        railwayDomainId = null;
        railwayDnsRecords = null;
        domainVerification = null;
      }

      // Add new domain to Railway
      if (customDomain) {
        try {
          const railwayDomain = await addCustomDomain(customDomain);
          railwayDomainId = railwayDomain.id;
          railwayDnsRecords = railwayDomain.dnsRecords;
          domainVerification = { status: "pending", checkedAt: new Date().toISOString(), expected: null, found: null };
          console.log(`✅ Added Railway domain: ${customDomain} (id: ${railwayDomain.id})`, { dnsRecords: railwayDomain.dnsRecords });
        } catch (error) {
          console.error("Railway domain creation error:", error);
          return NextResponse.json(
            {
              error: "Failed to provision custom domain on Railway. The domain was not saved.",
            },
            { status: 500 },
          );
        }
      }
    } else if (needsRecoveryProvisioning) {
      try {
        const railwayDomain = await addCustomDomain(resolvedDomain!);
        railwayDomainId = railwayDomain.id;
        railwayDnsRecords = railwayDomain.dnsRecords;
        domainVerification = { status: "pending", checkedAt: new Date().toISOString(), expected: null, found: null };
        console.log(`✅ Provisioned Railway domain (recovery): ${resolvedDomain} (id: ${railwayDomain.id})`, { dnsRecords: railwayDomain.dnsRecords });
      } catch (error) {
        console.error("Railway domain recovery provisioning error:", error);
        return NextResponse.json(
          {
            error: "Failed to provision custom domain on Railway. If the domain already exists in Railway, remove it from the Railway dashboard and try again.",
          },
          { status: 500 },
        );
      }
    }

    // Build update data object
    const updateData: any = {};
    if (businessName !== undefined) updateData.businessName = businessName;
    if (subdomain !== undefined) updateData.subdomain = subdomain;
    if (customDomain !== undefined) updateData.customDomain = customDomain || null;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Merge settings: preserve existing, overlay caller's settings, then overlay domain metadata
    const mergedSettings = {
      ...existingSettings,
      ...(settings || {}),
      railwayDomainId,
      railwayDnsRecords,
      domainVerification,
    };
    updateData.settings = mergedSettings;

    // Update tenant
    const tenant = await prisma.tenants.update({
      where: { id: params.id },
      data: updateData,
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "TENANT_UPDATED",
        entityType: "Tenant",
        entityId: params.id,
        userId: user.id,
        userEmail: user.email,
        tenantId: params.id,
        metadata: {
          changes: updateData,
        },
      },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

export const DELETE = withSuperAdminParams(async (_req, { user }, params) => {
  try {
    // Fetch tenant with related data needed for cleanup
    const tenant = await prisma.tenants.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: { id: true, email: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Clean up Clerk Organization and Users (best-effort — don't block DB delete)
    const clerkOrgId = (tenant.settings as any)?.clerkOrgId;
    const cleanupErrors: string[] = [];

    if (clerkOrgId) {
      try {
        const client = await clerkClient();
        await client.organizations.deleteOrganization(clerkOrgId);
        console.log(`🗑️ Deleted Clerk org: ${clerkOrgId}`);
      } catch (error: any) {
        const msg = `Failed to delete Clerk org ${clerkOrgId}: ${error.message}`;
        console.error(msg);
        cleanupErrors.push(msg);
      }
    }

    // Delete Clerk users associated with this tenant
    for (const tenantUser of tenant.users) {
      try {
        const client = await clerkClient();
        // Find Clerk user by email
        const clerkUsers = await client.users.getUserList({
          emailAddress: [tenantUser.email],
        });
        for (const cu of clerkUsers.data) {
          await client.users.deleteUser(cu.id);
          console.log(`🗑️ Deleted Clerk user: ${cu.id} (${tenantUser.email})`);
        }
      } catch (error: any) {
        const msg = `Failed to delete Clerk user ${tenantUser.email}: ${error.message}`;
        console.error(msg);
        cleanupErrors.push(msg);
      }
    }

    // Clean up Railway custom domain (best-effort)
    const railwayDomainId = (tenant.settings as any)?.railwayDomainId;
    if (railwayDomainId) {
      try {
        await removeCustomDomain(railwayDomainId);
        console.log(`🗑️ Removed Railway domain for tenant: ${tenant.customDomain}`);
      } catch (error: any) {
        const msg = `Failed to remove Railway domain ${railwayDomainId}: ${error.message}`;
        console.error(msg);
        cleanupErrors.push(msg);
      }
    }

    // Null out activeTenantTemplateId first to break circular FK
    // (tenants -> tenant_templates -> tenants cascade would deadlock otherwise)
    await prisma.tenants.update({
      where: { id: params.id },
      data: { activeTenantTemplateId: null },
    });

    // Delete tenant from DB (cascade handles related records)
    await prisma.tenants.delete({
      where: { id: params.id },
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "TENANT_DELETED",
        entityType: "Tenant",
        entityId: params.id,
        userId: user.id,
        userEmail: user.email,
        metadata: {
          businessName: tenant.businessName,
          subdomain: tenant.subdomain,
          clerkOrgId: clerkOrgId || null,
          cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined,
        },
      },
    });

    return NextResponse.json({
      success: true,
      cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined,
    });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
