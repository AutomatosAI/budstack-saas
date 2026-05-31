import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

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

const tenantUpdateSchema = z.object({
  businessName: z.string().max(200).optional(),
  countryCode: z.string().max(10).optional(),
  businessAddress1: z.string().max(200).optional(),
  businessAddress2: z.string().max(200).optional(),
  businessCity: z.string().max(120).optional(),
  businessState: z.string().max(120).optional(),
  businessPostalCode: z.string().max(20).optional(),
  businessCountry: z.string().max(120).optional(),
});

/**
 * PATCH /api/tenant-admin/tenant
 *
 * Update tenant company details.
 */
export const PATCH = withTenantAuth(async (req, { tenantId }) => {
  try {
    const body = await parseJsonBody(req, tenantUpdateSchema);

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
      const value = body[field];
      if (value !== undefined) {
        data[field] = value;
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
    return apiError(error, {
      route: "PATCH /api/tenant-admin/tenant",
      safeMessage: "Failed to update tenant",
    });
  }
});
