import { NextResponse } from "next/server";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseEntityId } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { FEATURES } from "@/lib/entitlements/features";
import { featureDenial } from "@/lib/entitlements/require-feature";
import { entitySeoWrite, isEmptyEntitySeo } from "@/lib/seo/entity-seo";
import { INDEXING_SEO_FIELDS, hasIndexingFields } from "@/lib/seo/indexing";

/**
 * SEO Supercharge US-005 — authoring for `conditions.seo`.
 *
 * Cloned from app/api/tenant-admin/seo/products/[id]/route.ts: same wrapper,
 * same schema, same ownership check, same empty-value handling — three sibling
 * entities that behave differently is how the SEO Manager's page list drifted
 * out of sync in the first place (US-002).
 *
 * ONE deliberate difference: `parseEntityId`, not `parseUuid`. `conditions`
 * declares `id String @id` with no database default, so an id is whatever the
 * writer supplied; a uuid gate would 400 valid rows.
 */

const seoUpdateSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(1000).optional(),
    ogImage: z.string().max(2000).optional(),
    // US-022 — the Pro indexing controls, gated on the FIELDS below rather than
    // on the route: everything above is Basic and must never 403.
    ...INDEXING_SEO_FIELDS,
  })
  .strict();

// GET - Fetch condition SEO
export const GET = requirePermissionParams("canViewSeo", async (_request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseEntityId(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/conditions/[id]" });
  }

  const condition = await prisma.conditions.findFirst({
    where: { id, tenantId: tenantId },
    select: { id: true, name: true, slug: true, seo: true },
  });

  if (!condition) {
    return apiError(new Error("Condition not found"), { route: "GET /api/tenant-admin/seo/conditions/[id]", status: 404, safeMessage: "Condition not found" });
  }

  return NextResponse.json(condition);
});

// PUT - Update condition SEO
export const PUT = requirePermissionParams("canEditSeo", async (request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseEntityId(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/conditions/[id]" });
  }

  // Verify condition belongs to tenant. A store also RENDERS the master
  // tenant's shared conditions (app/store/[slug]/conditions/page.tsx:24-36);
  // this 404s those, because editing one would rewrite every other store's
  // metadata for the same page.
  const existingCondition = await prisma.conditions.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingCondition) {
    return apiError(new Error("Condition not found"), { route: "PUT /api/tenant-admin/seo/conditions/[id]", status: 404, safeMessage: "Condition not found" });
  }

  let parsed;
  try {
    parsed = await parseJsonBody(request, seoUpdateSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/conditions/[id]" });
  }
  // US-022 — the plan gate, on the request that asks for the feature. One
  // lookup, and only when an indexing field is actually present, so a Basic
  // tenant saving a title pays nothing and is never refused.
  const writesIndexing = hasIndexingFields(parsed);
  if (writesIndexing) {
    const denial = await featureDenial(tenantId, FEATURES.SEO_PRO);
    if (denial) return denial;
  }

  // Trims, drops empty values, and — when this save may not write indexing
  // controls — carries the stored ones through untouched rather than erasing
  // them. See `entitySeoWrite`.
  const seo = entitySeoWrite(existingCondition.seo, parsed, {
    preserveIndexing: !writesIndexing,
    // US-002 — see the posts route: this editor has no `qa` field, so it
    // preserves rather than rebuilds. A condition's seeded FAQ is a different
    // column (`conditions.faqs`) and is not touched by this route at all.
    preserveQa: true,
  });

  const updated = await prisma.conditions.update({
    where: { id },
    data: {
      seo: isEmptyEntitySeo(seo) ? null : seo,
      updatedAt: new Date(),
    },
    select: { id: true, name: true, seo: true },
  });

  return NextResponse.json(updated);
});
