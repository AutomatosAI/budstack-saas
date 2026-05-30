import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

const TENANT_SELECT = {
  id: true,
  businessName: true,
  subdomain: true,
  customDomain: true,
  countryCode: true,
  businessAddress1: true,
  businessAddress2: true,
  businessCity: true,
  businessState: true,
  businessPostalCode: true,
  businessCountry: true,
} as const;

/**
 * GET /api/tenant-admin/tenant
 *
 * Fetch tenant data for the authenticated tenant admin.
 */
export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: TENANT_SELECT,
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant" },
      { status: 500 },
    );
  }
});

const ISO_COUNTRY_RE = /^[A-Z]{2}$/;

const UPDATABLE_FIELDS = [
  "businessName",
  "countryCode",
  "businessAddress1",
  "businessAddress2",
  "businessCity",
  "businessState",
  "businessPostalCode",
  "businessCountry",
] as const;

/**
 * PATCH /api/tenant-admin/tenant
 *
 * Update tenant company details.
 */
export const PATCH = withTenantAuth(async (req, { tenantId }) => {
  try {
    const body = await req.json();

    // Validate countryCode if provided
    if (body.countryCode !== undefined) {
      if (typeof body.countryCode !== "string" || !ISO_COUNTRY_RE.test(body.countryCode)) {
        return NextResponse.json(
          { error: "countryCode must be a 2-letter uppercase ISO code (e.g. ZA, PT, GB)" },
          { status: 400 },
        );
      }
    }

    // Pick only allowed fields
    const data: Record<string, string> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenants.update({
      where: { id: tenantId },
      data,
      select: TENANT_SELECT,
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json(
      { error: "Failed to update tenant" },
      { status: 500 },
    );
  }
});
