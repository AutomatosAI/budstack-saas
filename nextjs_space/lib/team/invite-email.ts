import { render } from "@react-email/components";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/email";
import { platformBaseUrl } from "@/lib/seo/platform-url";
import TeamInviteEmail from "@/emails/team-invite";

export interface SendTeamInviteEmailInput {
  tenantId: string;
  tenantName: string;
  email: string;
  role: string;
  token: string;
  inviterName?: string | null;
}

/**
 * Render + enqueue the branded team-invite email. Pulls the tenant's logo/colour
 * from tenant_branding (scoped read — caller must be in the tenant context) so the
 * invite matches the store's brand. Fire-and-forget send via the email queue.
 */
export async function sendTeamInviteEmail(input: SendTeamInviteEmailInput): Promise<void> {
  const { tenantId, tenantName, email, role, token, inviterName } = input;

  const branding = await prisma.tenant_branding
    .findFirst({ select: { logoUrl: true, primaryColor: true } })
    .catch(() => null);

  const acceptUrl = `${platformBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;

  const html = await render(
    TeamInviteEmail({
      tenantName,
      inviterName,
      role,
      acceptUrl,
      logoUrl: branding?.logoUrl ?? undefined,
      primaryColor: branding?.primaryColor ?? undefined,
    }),
  );

  await sendEmail({
    to: email,
    subject: `${tenantName} invited you to join their team on BudStacks`,
    html,
    tenantId,
    templateName: "teamInvite",
  });
}
