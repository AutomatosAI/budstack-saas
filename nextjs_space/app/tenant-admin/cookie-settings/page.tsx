import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Cookie } from "lucide-react";
import CookieSettingsForm from "./settings-form";

export default async function CookieSettingsPage() {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: { tenants: true },
  });

  if (!localUser?.tenants) {
    redirect("/tenant-admin");
  }

  const tenant = localUser.tenants;
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
