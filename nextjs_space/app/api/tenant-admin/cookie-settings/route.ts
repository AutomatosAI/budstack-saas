import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      (user.role !== "TENANT_ADMIN" &&
        user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });
    }

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
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      (user.role !== "TENANT_ADMIN" &&
        user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });
    }

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
}
