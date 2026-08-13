import { redirect } from "next/navigation";

import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";

import { NewCampaignClient } from "./client";

export default async function NewCampaignPage() {
  // US-009's gate on the page, matching the endpoint this screen saves to.
  // Authoring is `canEditEmails`, not `canViewEmails` — a viewer offered a
  // compose screen would only discover the refusal after writing the campaign.
  await requirePagePermission("canEditEmails");

  // PRD-302: impersonation-aware admin gate. The editor client saves through
  // impersonation-aware APIs, so this page needs no data of its own.
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  return <NewCampaignClient />;
}
