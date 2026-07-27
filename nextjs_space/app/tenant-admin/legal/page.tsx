import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { emptyLegalProfile } from "@/lib/legal/legal-profile-schema";
import { PRIVACY_TEMPLATE_VERSION } from "@/lib/legal/privacy-template";
import LegalProfileForm from "./legal-form";

/**
 * Where an operator supplies the controller identity that appears in their own
 * privacy notice. See docs/PRDS/prd-data-protection-remediation.md (US-008).
 */

export const dynamic = "force-dynamic";

/** Compose the tenant's trading address into a single default string. */
function tradingAddress(tenant: {
  businessAddress1: string | null;
  businessAddress2: string | null;
  businessCity: string | null;
  businessState: string | null;
  businessPostalCode: string | null;
  businessCountry: string | null;
}): string {
  return [
    tenant.businessAddress1,
    tenant.businessAddress2,
    tenant.businessCity,
    tenant.businessState,
    tenant.businessPostalCode,
    tenant.businessCountry,
  ]
    .filter((part) => part && part.trim() !== "")
    .join(", ");
}

export default async function TenantLegalPage() {
  await requirePagePermission("canEditSettings");

  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) redirect("/auth/login");

  const tenant = await prisma.tenants.findUnique({
    where: { id: active.tenantId },
  });
  if (!tenant) redirect("/dashboard");

  const profile = await prisma.tenant_legal_profiles.findFirst({
    where: { tenantId: active.tenantId },
  });

  const initial = profile
    ? {
        controllerLegalName: profile.controllerLegalName,
        registeredAddress: profile.registeredAddress,
        privacyContactEmail: profile.privacyContactEmail,
        icoRegistrationNumber: profile.icoRegistrationNumber ?? "",
        dpoName: profile.dpoName ?? "",
        dpoContact: profile.dpoContact ?? "",
        ukRepresentative: profile.ukRepresentative ?? "",
      }
    : // Pre-fill from trading details, but the operator must confirm them: the
      // registered legal entity and its registered address are frequently not
      // the trading name and shop address.
      emptyLegalProfile({
        businessName: tenant.businessName,
        address: tradingAddress(tenant),
      });

  return (
    <LegalProfileForm
      initial={initial}
      publishedAt={profile?.publishedAt?.toISOString() ?? null}
      publishedVersion={profile?.templateVersion ?? null}
      currentVersion={PRIVACY_TEMPLATE_VERSION}
      storefrontUrl={
        tenant.customDomain
          ? `https://${tenant.customDomain}/privacy`
          : `/store/${tenant.subdomain}/privacy`
      }
    />
  );
}
