import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { Cookie } from "lucide-react";
import CookieSettingsForm from "./settings-form";

export default async function CookieSettingsPage() {
  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const tenant = await prisma.tenants.findUnique({
    where: { id: active.tenantId },
  });

  if (!tenant) {
    redirect("/tenant-admin");
  }
  const settings = (tenant.settings as Record<string, any>) || {};

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <h1 className="bs-page-title">Cookie & Privacy Settings</h1>
        <p className="bs-page-subtitle">
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
