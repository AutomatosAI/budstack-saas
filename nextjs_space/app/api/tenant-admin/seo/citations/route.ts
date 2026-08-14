import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import { isAiAssistConnected } from "@/lib/seo/ai-assist";
import { CITATION_HISTORY_LIMIT } from "@/lib/seo/citation-monitor";
import { readCitationChecks } from "@/lib/seo/citation-monitor-store";

/**
 * LLM Visibility US-005 — this store's AI citation checks.
 *
 * TWO GATES, COMPOSED, in the sanctioned order (US-023's and US-001's
 * precedent): `requirePermission` answers "may this MEMBER", the
 * `requireFeature` inside it answers "may this TENANT". An unauthorised member
 * is refused before the plan lookup runs and never learns the store's plan.
 *
 * THE READ IS PLAN-GATED, like the audit and unlike the redirect routes. There
 * the rows are the owner's own authored work and hiding them behind a downgrade
 * would look like data loss; here the rows are a Pro diagnostic that a Basic
 * tenant's account was never charged to produce. A Basic tenant meets the locked
 * card in the Pro tab instead, which is where the upsell belongs.
 *
 * NO WRITE, AND NO MANUAL RUN. The only producer is the weekly worker sweep, so
 * there is no path here by which a click spends the tenant's AI account —
 * deliberate for v1, and the reason this route is a GET with no siblings.
 *
 * Tenant context is bound by `withTenantAuth` inside `requirePermission`, so the
 * scoped read below is legal as well as correct (it names `tenantId` itself; the
 * binding is what satisfies lib/db.ts's scope extension).
 */

const ROUTE = "/api/tenant-admin/seo/citations";

export const GET = requirePermission(
  "canViewSeo",
  requireFeature(FEATURES.SEO_PRO, async (_request, { tenantId }) => {
    try {
      // `connected` decides which EMPTY state the tab renders: a store with no
      // Automatos account gets the same connect card AI drafting shows, because
      // "not configured" is a cross-sell and not an error. It is a boolean and
      // only ever a boolean — the credential is read inside lib/seo/ai-assist.ts
      // and never leaves the server.
      const [connected, checks] = await Promise.all([
        isAiAssistConnected(tenantId),
        readCitationChecks(tenantId, CITATION_HISTORY_LIMIT),
      ]);

      // The rows only. Per-engine tallies are derived by the client from this
      // exact list through the shared pure `summariseCitationChecks`, so the tab
      // and any future surface cannot total the same rows differently.
      return NextResponse.json({ connected, checks });
    } catch (error) {
      return apiError(error, {
        route: `GET ${ROUTE}`,
        safeMessage: "Could not load your AI citation checks",
      });
    }
  }),
);
