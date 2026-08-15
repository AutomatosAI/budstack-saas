import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { getTenantFeatures } from "@/lib/entitlements/features";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  await requirePagePermission("canEditSettings");

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

  // Never expose Dr Green secrets to the client form.
  if (tenant.drGreenSecretKey) {
    tenant.drGreenSecretKey = "********";
  }
  if (tenant.drGreenApiKey) {
    tenant.drGreenApiKey = "********";
  }

  return (
    <div className="space-y-8">
      <header className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Store Settings
        </h1>
        <p className="bs-page-subtitle">
          Configure your store preferences and operations.
        </p>
      </header>

      <SettingsForm
        tenant={tenant}
        features={Array.from(getTenantFeatures({ id: tenant.id, plan: tenant.plan }))}
      />
    </div>
  );
}
