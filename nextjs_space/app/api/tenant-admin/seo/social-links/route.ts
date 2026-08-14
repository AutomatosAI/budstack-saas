import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  SOCIAL_LINKS_MAX,
  SOCIAL_LINK_MAX_LENGTH,
  checkSocialLinks,
  readSocialLinks,
} from "@/lib/seo/social-links";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * LLM Visibility US-006 — the profiles a store publishes as its own `sameAs`.
 *
 * TWO GATES, COMPOSED, in the sanctioned order (US-026's precedent):
 * `requirePermission` answers "may this MEMBER", the `requireFeature` inside it
 * answers "may this TENANT". An unauthorised member is refused before the plan
 * lookup runs and never learns the store's plan.
 *
 * TWO LAYERS OF VALIDATION, and both are load-bearing. Zod bounds the SHAPE —
 * an array of strings, each within the length cap, at most `SOCIAL_LINKS_MAX` of
 * them — which is what stops a hostile body before any of it is inspected.
 * `checkSocialLinks` then applies the CONTENT rule (absolute https, deduped),
 * which is the same function the card runs before it posts, so the owner reads
 * one message rather than two different ones for the same mistake.
 *
 * IT REFUSES RATHER THAN FILTERS. A save that quietly dropped the two lines it
 * did not like would return a shorter list than was typed and leave the owner to
 * work out which and why.
 *
 * THE MERGE IS READ-MODIFY-WRITE over the RAW blob, per the cookie-settings,
 * verification and ai-crawlers precedent: `tenants.settings` carries the whole
 * storefront configuration and writing back a parsed copy would quietly drop any
 * key this platform version does not know about.
 */

const ROUTE = "/api/tenant-admin/seo/social-links";

const updateSchema = z
  .object({
    socialLinks: z
      .array(z.string().max(SOCIAL_LINK_MAX_LENGTH))
      .max(SOCIAL_LINKS_MAX),
  })
  .strict();

export const PUT = requirePermission(
  "canEditSeo",
  requireFeature(FEATURES.SEO_PRO, async (request, { tenantId, user }) => {
    let parsed: z.infer<typeof updateSchema>;
    try {
      parsed = await parseJsonBody(request, updateSchema);
    } catch (error) {
      return apiError(error, { route: `PUT ${ROUTE}` });
    }

    const checked = checkSocialLinks(parsed.socialLinks);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.message }, { status: 400 });
    }
    const socialLinks = [...checked.value];

    try {
      const tenant: { settings: unknown } | null =
        await prisma.tenants.findFirst({
          where: { id: tenantId },
          select: { settings: true },
        });

      if (!tenant) {
        return apiError(new Error("Tenant not found"), {
          route: `PUT ${ROUTE}`,
          status: 404,
          safeMessage: "Store not found",
        });
      }

      const existing = (tenant.settings as Record<string, unknown>) ?? {};
      // The list BEFORE the write, read through the same parser the storefront
      // publishes from — so the audit row records the transition an operator
      // would recognise rather than a raw column value that may never have been
      // set, or one carrying entries the store never actually published.
      const previous = readSocialLinks(existing);

      await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          settings: { ...existing, socialLinks },
          updatedAt: new Date(),
        },
      });

      const { ipAddress, userAgent } = getClientInfo(request.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.SEO_SOCIAL_LINKS_UPDATED,
        entityType: "Tenant",
        entityId: tenantId,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: { from: previous, to: socialLinks },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ socialLinks });
    } catch (error) {
      return apiError(error, {
        route: `PUT ${ROUTE}`,
        safeMessage: "Could not save those links",
      });
    }
  }),
);
