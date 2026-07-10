import { redirect } from "next/navigation";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { TenantNewTemplateClient } from "./client";

export default async function TenantNewEmailPage() {
  // PRD-302: impersonation-aware admin gate (the editor client fetches its data
  // via impersonation-aware APIs, so this page only needs the access check).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  return <TenantNewTemplateClient />;
}
