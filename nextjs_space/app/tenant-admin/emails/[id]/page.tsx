import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { TenantEditTemplateClient } from "./client";

export default async function TenantEditEmailPage({
  params,
}: {
  params: { id: string };
}) {
  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const template = await prisma.email_templates.findFirst({
    where: {
      id: params.id,
      tenantId: active.tenantId, // Strict ownership (impersonation-aware)
    },
  });

  if (!template) {
    notFound();
  }

  // Convert Decimals/Dates if needed? Prisma usually fine for simple objects passed to client component.
  // Assuming simple fields.

  return <TenantEditTemplateClient template={template as any} />;
}
