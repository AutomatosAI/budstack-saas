import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "TENANT_ADMIN" &&
        session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const settings = (user.tenants.settings as Record<string, any>) || {};

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
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "TENANT_ADMIN" &&
        session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
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
      (user.tenants.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...existingSettings,
      cookieConsentEnabled,
      cookieBannerMessage,
      cookiePolicyUrl,
      analyticsEnabled,
      marketingCookiesEnabled,
    };

    await prisma.tenants.update({
      where: { id: user.tenants.id },
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
