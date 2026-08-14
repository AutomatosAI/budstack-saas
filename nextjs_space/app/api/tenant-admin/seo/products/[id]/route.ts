import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { FEATURES } from "@/lib/entitlements/features";
import { featureDenial } from "@/lib/entitlements/require-feature";
import { entitySeoWrite, isEmptyEntitySeo } from "@/lib/seo/entity-seo";
import { INDEXING_SEO_FIELDS, hasIndexingFields } from "@/lib/seo/indexing";
import { PRODUCT_QA_LIMITS, hasQaField } from "@/lib/seo/product-qa";

const seoUpdateSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(1000).optional(),
    ogImage: z.string().max(2000).optional(),
    // US-009 — alt text for the product's imagery. Capped well under the
    // description limit: an alt string is a sentence, not a paragraph, and a
    // screen reader reads the whole of it before anything else on the page.
    imageAlt: z.string().max(300).optional(),
    // US-022 — the Pro indexing controls, gated on the FIELDS below rather than
    // on the route: everything above is Basic and must never 403.
    ...INDEXING_SEO_FIELDS,
    /**
     * LLM Visibility US-002 — the product's Q&A, Pro and product-only. Declared
     * here rather than in a shared field set because no other SEO PUT route
     * accepts it: theirs are `.strict()` and list no `qa`, so a `qa` sent to the
     * posts, conditions or pages editor is a 400 rather than a key that lands in
     * a column nothing renders.
     *
     * The limits are `PRODUCT_QA_LIMITS`, the same numbers the storage parser,
     * the editor's counters and the AI draft contract read, so a draft that was
     * accepted cannot be rejected on the way to the column. `.strict()` on the
     * entry keeps an editor's local `id` out of the stored blob; the entries are
     * re-parsed by `readEntitySeo` regardless.
     */
    qa: z
      .array(
        z
          .object({
            question: z.string().trim().min(1).max(PRODUCT_QA_LIMITS.maxQuestionLength),
            answer: z.string().trim().min(1).max(PRODUCT_QA_LIMITS.maxAnswerLength),
          })
          .strict(),
      )
      .max(PRODUCT_QA_LIMITS.maxPairs)
      .optional(),
  })
  .strict();

// GET - Fetch product SEO
export const GET = requirePermissionParams("canViewSeo", async (_request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/products/[id]" });
  }

  const product = await prisma.products.findFirst({
    where: { id, tenantId: tenantId },
    select: { id: true, name: true, slug: true, seo: true },
  });

  if (!product) {
    return apiError(new Error("Product not found"), { route: "GET /api/tenant-admin/seo/products/[id]", status: 404, safeMessage: "Product not found" });
  }

  return NextResponse.json(product);
});

// PUT - Update product SEO
export const PUT = requirePermissionParams("canEditSeo", async (request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/products/[id]" });
  }

  // Verify product belongs to tenant
  const existingProduct = await prisma.products.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingProduct) {
    return apiError(new Error("Product not found"), { route: "PUT /api/tenant-admin/seo/products/[id]", status: 404, safeMessage: "Product not found" });
  }

  let parsed;
  try {
    parsed = await parseJsonBody(request, seoUpdateSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/products/[id]" });
  }
  // US-022 / US-002 — the plan gate, on the request that asks for a Pro field.
  // ONE lookup covering both groups, and only when one of them is actually
  // present, so a Basic tenant saving a title pays nothing and is never refused.
  const writesIndexing = hasIndexingFields(parsed);
  const writesQa = hasQaField(parsed);
  if (writesIndexing || writesQa) {
    const denial = await featureDenial(tenantId, FEATURES.SEO_PRO);
    if (denial) return denial;
  }

  // Trims, drops empty values, and — for each group of Pro fields this save may
  // not write — carries the stored ones through untouched rather than erasing
  // them. The two flags are independent: a Pro tenant editing only Q&A must not
  // have their indexing rules rewritten from a body that never mentioned them.
  // See `entitySeoWrite`.
  const seo = entitySeoWrite(existingProduct.seo, parsed, {
    preserveIndexing: !writesIndexing,
    preserveQa: !writesQa,
  });

  const updated = await prisma.products.update({
    where: { id },
    data: {
      // DbNull, not a bare null: `null` is not a legal value for a nullable
      // Json column (lib/email/email-template-content.ts:93-94), so emptying
      // every field threw instead of clearing the record. Reachable in one
      // click now that US-009 put a fourth field in this editor.
      seo: isEmptyEntitySeo(seo) ? Prisma.DbNull : seo,
      updatedAt: new Date(),
    },
    select: { id: true, name: true, seo: true },
  });

  return NextResponse.json(updated);
});
