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

  // US-013 — the event this template is mapped to, which decides the merge tags
  // the editor offers. Tenant-scoped like the template itself, and null when
  // nothing is mapped to it yet: the editor then offers the common tags only.
  const mapping = await prisma.email_event_mappings.findFirst({
    where: { templateId: template.id, tenantId: active.tenantId },
    select: { eventType: true },
  });

  // Convert Decimals/Dates if needed? Prisma usually fine for simple objects passed to client component.
  // Assuming simple fields.

  return (
    <TenantEditTemplateClient
      template={template as any}
      eventType={mapping?.eventType ?? null}
    />
  );
}
