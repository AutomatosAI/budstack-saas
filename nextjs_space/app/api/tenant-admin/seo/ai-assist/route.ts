import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  AI_ASSIST_ENTITY_KINDS,
  AI_ASSIST_KINDS,
  type AiAssistEntityKind,
  type AiAssistSource,
} from "@/lib/seo/ai-assist-contract";
import {
  conditionAiAssistSource,
  postAiAssistSource,
  productAiAssistSource,
  storePageAiAssistSource,
  type AiAssistConditionRow,
  type AiAssistPostRow,
  type AiAssistProductRow,
} from "@/lib/seo/ai-assist-source";
import { generateSeoDraft, type AiAssistResult } from "@/lib/seo/ai-assist";
import {
  STORE_SEO_PAGE_KEYS,
  type StoreSeoPageKey,
} from "@/lib/seo/store-pages";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * SEO Supercharge US-025 — one field, one draft, on the tenant's own Automatos
 * account.
 *
 * TWO GATES, COMPOSED, in the order every Pro write uses: `requirePermission`
 * answers "may this MEMBER" and `requireFeature` answers "may this TENANT", so a
 * member without `canEditSeo` is refused before the plan lookup runs and never
 * learns the store's plan. The button in the editor is presentation; THIS is the
 * boundary — a Basic tenant calling the URL by hand gets 403 `upgrade_required`.
 *
 * THE REQUEST NAMES AN ENTITY, NOT A PROMPT. Body is `{kind, entityType,
 * entityId}`; the copy the model is given is read HERE from the tenant's own row
 * (`lib/seo/ai-assist-source.ts`). Nothing a caller sends reaches the prompt as
 * text, and an id belonging to another tenant simply does not resolve — the
 * selects name `tenantId` and the ambient scope binding from `withTenantAuth`
 * backs them up.
 *
 * NOTHING IS SAVED. The draft is returned to the editor as an editable value;
 * the owner reviews it and the ordinary save routes write it, with their own
 * validation. That is deliberate — an AI sentence that reached the storefront
 * without a human reading it is the failure mode this feature is designed
 * around.
 *
 * METERING lives in the service (per tenant, fail-closed) because that is where
 * the tenant's own AI quota is spent. The two reads below therefore run
 * unmetered — accepted: they are indexed primary-key lookups, reachable only by
 * an authenticated member who holds `canEditSeo` on a Pro tenant.
 */

const ROUTE = "/api/tenant-admin/seo/ai-assist";

const requestSchema = z
  .object({
    kind: z.enum(AI_ASSIST_KINDS),
    entityType: z.enum(AI_ASSIST_ENTITY_KINDS),
    // Ids are cuid/uuid-ish and page keys are short words; the cap is a sanity
    // bound, and the value is only ever used as a `where` argument.
    entityId: z.string().min(1).max(200),
  })
  .strict();

type AiAssistRequest = z.infer<typeof requestSchema>;

/** What the audit trail calls each entity — the row records what got a draft. */
const AUDIT_ENTITY_TYPE: Readonly<Record<AiAssistEntityKind, string>> = {
  product: "Product",
  post: "Post",
  condition: "Condition",
  page: "StorePage",
};

/**
 * The entity's own copy, or null when this tenant has no such row.
 *
 * Null is a 404 and never a prompt: writing a draft for an entity we could not
 * read would mean writing it from the id in the URL.
 */
async function loadSource(
  tenantId: string,
  request: AiAssistRequest,
  storeName: string | null,
): Promise<AiAssistSource | null> {
  const tenant = { storeName };

  if (request.entityType === "page") {
    // The key space is closed (`STORE_SEO_PAGE_KEYS`), so an unknown page key is
    // as absent as a missing row rather than something to guess at.
    return (STORE_SEO_PAGE_KEYS as readonly string[]).includes(request.entityId)
      ? storePageAiAssistSource(request.entityId as StoreSeoPageKey, tenant)
      : null;
  }

  // Rows are annotated explicitly: lib/db.ts's `prisma` export is any-widened by
  // its build-time mock Proxy, so an inferred row would collapse to `any` and
  // take the source shaping's types with it.
  if (request.entityType === "product") {
    const row: AiAssistProductRow | null = await prisma.products.findFirst({
      where: { id: request.entityId, tenantId },
      select: { name: true, description: true },
    });
    return row ? productAiAssistSource(row, tenant) : null;
  }

  if (request.entityType === "post") {
    const row: AiAssistPostRow | null = await prisma.posts.findFirst({
      where: { id: request.entityId, tenantId },
      select: { title: true, excerpt: true, content: true },
    });
    return row ? postAiAssistSource(row, tenant) : null;
  }

  const row: AiAssistConditionRow | null = await prisma.conditions.findFirst({
    where: { id: request.entityId, tenantId },
    select: { name: true, description: true },
  });
  return row ? conditionAiAssistSource(row, tenant) : null;
}

/**
 * The HTTP shape of one service result.
 *
 * `unavailable` is a 200: "you have not connected an account" is a STATE of the
 * feature, not a failure of the request, and the editor renders a connect card
 * for it rather than an error. Everything the client needs to choose its wording
 * travels as machine-readable fields — `status`, `reason` — with `error`
 * carrying a sentence for the cases where there is nothing better to say.
 */
function respond(result: AiAssistResult): NextResponse {
  switch (result.status) {
    case "ok":
    case "unavailable":
      return NextResponse.json(result);

    case "rate_limited": {
      const response = NextResponse.json(
        { ...result, error: "Too many drafts in a short time. Try again shortly." },
        { status: 429 },
      );
      if (result.retryAfterSeconds !== undefined) {
        response.headers.set("retry-after", String(result.retryAfterSeconds));
      }
      return response;
    }

    // 422: the request was valid and the model answered — the ANSWER was not
    // something we are willing to put in a meta tag. Never a trimmed draft.
    case "refused":
      return NextResponse.json(
        { ...result, error: "The assistant's answer could not be used." },
        { status: 422 },
      );

    default:
      // 503 where our own side is temporarily unable; 502 where the tenant's AI
      // provider is. The client tells them apart by `reason`, not by status.
      return NextResponse.json(
        {
          ...result,
          error: "The assistant could not be reached. Try again in a moment.",
        },
        {
          status:
            result.reason === "lookup_failed" ||
            result.reason === "rate_limiter_unavailable"
              ? 503
              : 502,
        },
      );
  }
}

export const POST = requirePermission(
  "canEditSeo",
  requireFeature(FEATURES.SEO_PRO, async (request, { tenantId, user }) => {
    let parsed: AiAssistRequest;
    try {
      parsed = await parseJsonBody(request, requestSchema);
    } catch (error) {
      return apiError(error, { route: `POST ${ROUTE}` });
    }

    let source: AiAssistSource | null;
    try {
      const tenant: { businessName: string | null } | null =
        await prisma.tenants.findFirst({
          where: { id: tenantId },
          select: { businessName: true },
        });
      source = await loadSource(tenantId, parsed, tenant?.businessName ?? null);
    } catch (error) {
      return apiError(error, {
        route: `POST ${ROUTE}`,
        safeMessage: "Could not read that page's content",
      });
    }

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await generateSeoDraft({
      tenantId,
      kind: parsed.kind,
      source,
    });

    // ONE ROW PER GENERATION — where "a generation" means the model was asked
    // and answered, so `ok` and `refused` both count and the outcomes that never
    // reached it (no credentials, rate limited, our own lookup failing) do not.
    // The drafted TEXT is deliberately absent: it is not saved by this route, and
    // what is published is already recorded by the write route that saves it.
    if (result.status === "ok" || result.status === "refused") {
      await createAuditLog({
        action: AUDIT_ACTIONS.SEO_AI_DRAFT_GENERATED,
        entityType: AUDIT_ENTITY_TYPE[parsed.entityType],
        entityId: parsed.entityId,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: {
          field: parsed.kind,
          outcome: result.status,
          ...(result.status === "ok"
            ? { provider: result.provider, length: result.text.length }
            : { refusedBecause: result.reason }),
        },
        ...getClientInfo(request.headers),
      });
    }

    return respond(result);
  }),
);
