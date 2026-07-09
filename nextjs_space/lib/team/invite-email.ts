import { render } from "@react-email/components";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/email";
import TeamInviteEmail from "@/emails/team-invite";

export interface SendTeamInviteEmailInput {
  tenantId: string;
  tenantName: string;
  email: string;
  role: string;
  token: string;
  inviterName?: string | null;
}

function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_BASE_DOMAIN) {
    return `https://${process.env.NEXT_PUBLIC_BASE_DOMAIN}`;
  }
  return "https://budstacks.io";
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

  const acceptUrl = `${appBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;

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
