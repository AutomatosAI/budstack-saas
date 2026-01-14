import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Cookie } from "lucide-react";
import CookieSettingsForm from "./settings-form";

export default async function CookieSettingsPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    (session.user.role !== "TENANT_ADMIN" &&
      session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { tenants: true },
  });

  if (!user?.tenants) {
    redirect("/tenant-admin");
  }

  const tenant = user.tenants;
  const settings = (tenant.settings as Record<string, any>) || {};

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Cookie className="h-4 w-4" />
          Privacy
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Cookie & Privacy Settings
        </h1>
        <p className="mt-3 text-muted-foreground">
          Configure how cookies are managed on your storefront. Based on your
          country ({tenant.countryCode}), we automatically apply the appropriate
          consent model.
        </p>
      </div>

      <CookieSettingsForm
        tenantId={tenant.id}
        countryCode={tenant.countryCode}
        initialSettings={{
          cookieConsentEnabled: settings.cookieConsentEnabled ?? true,
          cookieBannerMessage: settings.cookieBannerMessage ?? "",
          cookiePolicyUrl: settings.cookiePolicyUrl ?? "",
          analyticsEnabled: settings.analyticsEnabled ?? false,
          marketingCookiesEnabled: settings.marketingCookiesEnabled ?? false,
        }}
      />
    </div>
  );
}
