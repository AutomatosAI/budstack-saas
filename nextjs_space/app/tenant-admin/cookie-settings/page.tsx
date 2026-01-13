import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CookieSettingsForm from "./settings-form";
import { Breadcrumbs } from "@/components/admin/shared";

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
    <div className="p-8">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/tenant-admin" },
          { label: "Cookie Settings" },
        ]}
        className="mb-4"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Cookie & Privacy Settings
        </h1>
        <p className="text-slate-600 mt-2">
          Configure how cookies are managed on your storefront. Based on your
          country ({tenant.countryCode}), we automatically apply the appropriate
          consent model.
        </p>
      </div>

      <div className="max-w-4xl">
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
    </div>
  );
}
