import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

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

    const body = await request.json();
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
    console.error("Error updating cookie settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
