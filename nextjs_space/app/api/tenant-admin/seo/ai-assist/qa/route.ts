import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  productAiAssistSource,
  type AiAssistProductRow,
} from "@/lib/seo/ai-assist-source";
import { generateQaDraft } from "@/lib/seo/ai-assist";
import { aiAssistFailureResponse } from "@/lib/seo/ai-assist-http";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * LLM Visibility US-002 — "Draft Q&A with Automatos AI".
 *
 * A SIBLING OF `/seo/ai-assist`, NOT A BRANCH OF IT. The parent route answers
 * "one field, one string"; this one answers "one product, a list of pairs". They
 * share the gates, the service's metering and credential rules, and every
 * non-draft HTTP shape (`lib/seo/ai-assist-http.ts`) — what they cannot share is
 * the contract for a valid answer, and folding a second output shape into the
 * parent's `kind` enum would have put a list-shaped result behind a type whose
 * every consumer reads `.text`.
 *
 * TWO GATES, COMPOSED, in the order every Pro write uses: `requirePermission`
 * answers "may this MEMBER" and `requireFeature` answers "may this TENANT", so a
 * member without `canEditSeo` is refused before the plan lookup runs and never
 * learns the store's plan. The button in the editor is presentation; THIS is the
 * boundary — a Basic tenant calling the URL by hand gets 403 `upgrade_required`.
 *
 * PRODUCTS ONLY, because `products.seo.qa` is the only place Q&A is stored and
 * the product page is the only page that renders it. The body names an id and
 * nothing else; the copy the model is given is read HERE from the tenant's own
 * row, so there is no field on the wire a caller could put prompt text into and
 * an id belonging to another tenant simply does not resolve.
 *
 * NOTHING IS SAVED. The pairs are returned to the editor as editable rows; the
 * ordinary product SEO PUT writes them, with its own validation and its own plan
 * gate. An AI answer that reached a storefront without a human reading it is the
 * failure mode this whole feature is designed around.
 */

const ROUTE = "/api/tenant-admin/seo/ai-assist/qa";

const requestSchema = z
  .object({
    // Ids are cuid/uuid-ish; the cap is a sanity bound, and the value is only
    // ever used as a `where` argument.
    productId: z.string().min(1).max(200),
  })
  .strict();

type QaDraftRequestBody = z.infer<typeof requestSchema>;

export const POST = requirePermission(
  "canEditSeo",
  requireFeature(FEATURES.SEO_PRO, async (request, { tenantId, user }) => {
    let parsed: QaDraftRequestBody;
    try {
      parsed = await parseJsonBody(request, requestSchema);
    } catch (error) {
      return apiError(error, { route: `POST ${ROUTE}` });
    }

    // Rows are annotated explicitly: lib/db.ts's `prisma` export is any-widened
    // by its build-time mock Proxy, so an inferred row would collapse to `any`
    // and take the source shaping's types with it.
    let product: AiAssistProductRow | null;
    let storeName: string | null;
    try {
      const tenant: { businessName: string | null } | null =
        await prisma.tenants.findFirst({
          where: { id: tenantId },
          select: { businessName: true },
        });
      storeName = tenant?.businessName ?? null;

      product = await prisma.products.findFirst({
        where: { id: parsed.productId, tenantId },
        select: { name: true, description: true },
      });
    } catch (error) {
      return apiError(error, {
        route: `POST ${ROUTE}`,
        safeMessage: "Could not read that product's content",
      });
    }

    // Null is a 404 and never a prompt: drafting for a product we could not read
    // would mean drafting from the id in the URL.
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await generateQaDraft({
      tenantId,
      source: productAiAssistSource(product, { storeName }),
    });

    // ONE ROW PER GENERATION — where "a generation" means the model was asked
    // and answered, so `ok` and `refused` both count and the outcomes that never
    // reached it (no credentials, rate limited, our own lookup failing) do not.
    // The drafted PAIRS are deliberately absent: they are not saved by this
    // route, and what is published is recorded by the write route that saves it.
    if (result.status === "ok" || result.status === "refused") {
      await createAuditLog({
        action: AUDIT_ACTIONS.SEO_AI_DRAFT_GENERATED,
        entityType: "Product",
        entityId: parsed.productId,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: {
          field: "qa",
          outcome: result.status,
          ...(result.status === "ok"
            ? { provider: result.provider, pairs: result.pairs.length }
            : { refusedBecause: result.reason }),
        },
        ...getClientInfo(request.headers),
      });
    }

    return result.status === "ok"
      ? NextResponse.json(result)
      : aiAssistFailureResponse(result);
  }),
);
