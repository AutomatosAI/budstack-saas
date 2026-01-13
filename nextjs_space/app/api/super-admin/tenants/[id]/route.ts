import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNamecheapClient } from "@/lib/namecheap-api";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
          `✅ Created subdomain: ${existingTenant.subdomain}.budstack.to`,
        );
      } catch (error) {
        console.error("Namecheap API error:", error);
        return NextResponse.json(
          {
            error:
              "Failed to create subdomain. Please check Namecheap API credentials and whitelisted IP.",
            details: error instanceof Error ? error.message : "Unknown error",
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
          `🗑️ Deleted subdomain: ${existingTenant.subdomain}.budstack.to`,
        );
      } catch (error) {
        console.error("Error deleting subdomain:", error);
        // Don't fail the whole request if subdomain deletion fails
      }
    }

    // Build update data object
    const updateData: any = {};
    if (businessName !== undefined) updateData.businessName = businessName;
    if (subdomain !== undefined) updateData.subdomain = subdomain;
    if (customDomain !== undefined) updateData.customDomain = customDomain;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (settings !== undefined) updateData.settings = settings;

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
        userId: session.user.id,
        userEmail: session.user.email,
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
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete tenant (cascade will handle related records)
    await prisma.tenants.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
