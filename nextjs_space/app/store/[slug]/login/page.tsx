import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getTenantBasePath } from "@/lib/tenant-utils";
import { TenantLoginForm } from "./login-form";

export default async function TenantLoginPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const branding = await prisma.tenant_branding.findUnique({
    where: { tenantId: tenant.id },
    select: { logoUrl: true },
  });

  const basePath = getTenantBasePath(tenant.subdomain);

  return (
    <TenantLoginForm
      businessName={tenant.businessName}
      logoUrl={branding?.logoUrl || null}
      basePath={basePath}
    />
  );
}
