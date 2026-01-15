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
    redirect("/sign-in");
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
