import { notFound, redirect } from "next/navigation";
import type { CampaignStatus } from "@prisma/client";

import { asEmailContentJson } from "@/components/admin/email/email-editor-mode";
import { prisma } from "@/lib/db";
import { parseCampaignAudience } from "@/lib/email/campaign-audience";
import { CAMPAIGN_DETAIL_SELECT } from "@/lib/email/campaign-fields";
import { isCampaignEditable } from "@/lib/email/campaign-rules";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";

import { EditCampaignClient } from "./client";

/**
 * What `CAMPAIGN_DETAIL_SELECT` returns, stated because `prisma` is exported as
 * `any` (lib/db.ts) — without it the props below would be built unchecked.
 */
interface CampaignDetailRow {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  scheduledAt: Date | null;
  contentJson: unknown;
  audience: unknown;
}

export default async function EditCampaignPage({
  params,
}: {
  params: { id: string };
}) {
  // US-009's gate, applied to the PAGE and not only to the API it calls.
  // A team member can hold `users.role = TENANT_ADMIN` with a teamRole that
  // grants no email permissions at all (editor, web_designer, customer_support
  // — see lib/permissions/preset-roles.ts); without this they would be 403'd by
  // the campaign endpoints but could still read a campaign's subject and
  // document by navigating straight here.
  await requirePagePermission("canViewEmails");

  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  // `campaigns` is a tenant-scoped model, and a Server Component binds no
  // tenant context of its own — so without this the $extends layer sees an
  // UNBOUND context, warns on `security.tenant_context_missing` (the channel
  // the tenant-leak alerting reads) and would throw outright under
  // TENANT_CONTEXT_STRICT. The explicit tenantId below is what makes the query
  // correct; this is what makes it quiet.
  const campaign: CampaignDetailRow | null = await runWithTenantContextAsync(
    active.tenantId,
    () =>
      prisma.campaigns.findFirst({
        where: {
          id: params.id,
          tenantId: active.tenantId, // Strict ownership (impersonation-aware)
        },
        select: CAMPAIGN_DETAIL_SELECT,
      }),
  );

  if (!campaign) {
    notFound();
  }

  return (
    <EditCampaignClient
      campaign={{
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        // US-021. Serialised here because a Date does not survive the boundary
        // into a client component, and the picker needs a real instant to turn
        // back into the author's own local time.
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
        // Narrowed here rather than in the client: the Json column is genuinely
        // unknown, and the composer must be handed a document or nothing.
        contentJson: asEmailContentJson(campaign.contentJson),
        // Same rule for the audience rule (US-018): anything this version
        // cannot read comes through as "not chosen", never as "everybody".
        audience: parseCampaignAudience(campaign.audience),
      }}
      isEditable={isCampaignEditable(campaign.status)}
    />
  );
}
