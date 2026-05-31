import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const cookieSettingsSchema = z.object({
  cookieConsentEnabled: z.boolean().optional(),
  cookieBannerMessage: z.string().max(2000).optional(),
  cookiePolicyUrl: z.string().max(2000).optional(),
  analyticsEnabled: z.boolean().optional(),
  marketingCookiesEnabled: z.boolean().optional(),
});

export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const settings = (tenant.settings as Record<string, any>) || {};

    return NextResponse.json({
      cookieConsentEnabled: settings.cookieConsentEnabled ?? true,
      cookieBannerMessage: settings.cookieBannerMessage ?? "",
      cookiePolicyUrl: settings.cookiePolicyUrl ?? "",
      analyticsEnabled: settings.analyticsEnabled ?? false,
      marketingCookiesEnabled: settings.marketingCookiesEnabled ?? false,
    });
  } catch (error) {
    console.error("Error fetching cookie settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

export const POST = withTenantAuth(async (request, { tenantId }) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await parseJsonBody(request, cookieSettingsSchema);
    const {
      cookieConsentEnabled,
      cookieBannerMessage,
      cookiePolicyUrl,
      analyticsEnabled,
      marketingCookiesEnabled,
    } = body;

    // Merge with existing settings
    const existingSettings =
      (tenant.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...existingSettings,
      cookieConsentEnabled,
      cookieBannerMessage,
      cookiePolicyUrl,
      analyticsEnabled,
      marketingCookiesEnabled,
    };

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/cookie-settings",
      safeMessage: "Internal server error",
    });
  }
});
