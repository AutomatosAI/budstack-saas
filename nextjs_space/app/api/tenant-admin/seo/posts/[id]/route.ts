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

const seoUpdateSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(1000).optional(),
    ogImage: z.string().max(2000).optional(),
    // US-009 — cover-image alt text. The Wire's post editor writes the same key
    // (app/api/tenant-admin/posts/[id]/route.ts), and this route REPLACES the
    // column wholesale, so it has to carry the field or a save from the SEO
    // Manager would erase the alt the author wrote next to the image.
    imageAlt: z.string().max(300).optional(),
    // US-022 — the Pro indexing controls, gated on the FIELDS below rather than
    // on the route: everything above is Basic and must never 403.
    ...INDEXING_SEO_FIELDS,
  })
  .strict();

// GET - Fetch post SEO
export const GET = requirePermissionParams("canViewSeo", async (_request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/posts/[id]" });
  }

  const post = await prisma.posts.findFirst({
    where: { id, tenantId: tenantId },
    select: { id: true, title: true, slug: true, seo: true },
  });

  if (!post) {
    return apiError(new Error("Post not found"), { route: "GET /api/tenant-admin/seo/posts/[id]", status: 404, safeMessage: "Post not found" });
  }

  return NextResponse.json(post);
});

// PUT - Update post SEO
export const PUT = requirePermissionParams("canEditSeo", async (request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/posts/[id]" });
  }

  // Verify post belongs to tenant
  const existingPost = await prisma.posts.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingPost) {
    return apiError(new Error("Post not found"), { route: "PUT /api/tenant-admin/seo/posts/[id]", status: 404, safeMessage: "Post not found" });
  }

  let parsed;
  try {
    parsed = await parseJsonBody(request, seoUpdateSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/posts/[id]" });
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
  const seo = entitySeoWrite(existingPost.seo, parsed, {
    preserveIndexing: !writesIndexing,
    // US-002 — this editor is not Q&A's editor: the schema above has no `qa`,
    // so a save from here must carry any stored pairs through rather than
    // rebuild the record without them. Stated rather than left to the default,
    // for the reason `withEntityImageAlt` documents: one column, several
    // editors, and a blind write from any of them drops another's work.
    preserveQa: true,
  });

  const updated = await prisma.posts.update({
    where: { id },
    data: {
      // DbNull, not a bare null: `null` is not a legal value for a nullable
      // Json column (lib/email/email-template-content.ts:93-94), so emptying
      // every field threw instead of clearing the record. Reachable in one
      // click now that US-009 put a fourth field in this editor.
      seo: isEmptyEntitySeo(seo) ? Prisma.DbNull : seo,
      updatedAt: new Date(),
    },
    select: { id: true, title: true, seo: true },
  });

  return NextResponse.json(updated);
});
