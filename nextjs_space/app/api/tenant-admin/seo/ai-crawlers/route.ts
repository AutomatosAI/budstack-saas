import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  AI_CRAWLER_POLICIES,
  parseAiCrawlerPolicy,
  type AiCrawlerPolicy,
} from "@/lib/seo/ai-crawlers";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * LLM Visibility US-001 — which classes of AI crawler the storefront's
 * robots.txt welcomes.
 *
 * TWO GATES, COMPOSED, in the sanctioned order (US-026's precedent):
 * `requirePermission` answers "may this MEMBER", the `requireFeature` inside it
 * answers "may this TENANT". An unauthorised member is refused before the plan
 * lookup runs and never learns the store's plan.
 *
 * ONE ENUM FIELD AND NOTHING ELSE (`.strict()`). Unlike the verification tokens
 * this value IS pinned to its enum on the wire — the set is closed and three
 * values wide, so there is no round-trip risk in refusing anything else.
 *
 * THE MERGE IS READ-MODIFY-WRITE over the RAW blob, per the cookie-settings and
 * verification precedent: `tenants.settings` carries the whole storefront
 * configuration and writing back a parsed copy would quietly drop any key this
 * platform version does not know about.
 */

const ROUTE = "/api/tenant-admin/seo/ai-crawlers";

const updateSchema = z
  .object({
    aiCrawlerPolicy: z.enum(AI_CRAWLER_POLICIES),
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

    const aiCrawlerPolicy: AiCrawlerPolicy = parsed.aiCrawlerPolicy;

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
      // The value BEFORE the write, read through the same fail-open parser the
      // storefront uses — so the audit row records the transition an operator
      // would recognise ('open' → 'blocked') rather than a raw column value that
      // may never have been set.
      const previous = parseAiCrawlerPolicy(existing.aiCrawlerPolicy);

      await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          settings: { ...existing, aiCrawlerPolicy },
          updatedAt: new Date(),
        },
      });

      const { ipAddress, userAgent } = getClientInfo(request.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.SEO_AI_CRAWLERS_UPDATED,
        entityType: "Tenant",
        entityId: tenantId,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: { from: previous, to: aiCrawlerPolicy },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ aiCrawlerPolicy });
    } catch (error) {
      return apiError(error, {
        route: `PUT ${ROUTE}`,
        safeMessage: "Could not save that setting",
      });
    }
  }),
);
