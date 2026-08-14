import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import {
  checkRedirectWrite,
  REDIRECT_REJECTION_MESSAGES,
} from "@/lib/seo/redirect-write";
import {
  SEO_REDIRECT_MAX_PATH_LENGTH,
  SEO_REDIRECT_STATUS_CODES,
} from "@/lib/seo/redirects";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * SEO Supercharge US-020 — retarget or delete one redirect.
 *
 * `fromPath` is IMMUTABLE here. Changing which path a rule claims is not an
 * edit, it is a different rule: the old path stops redirecting and a new one
 * starts, and doing that through a PUT hides a deletion inside what reads like a
 * tweak. Delete and re-add says what actually happened.
 *
 * Both handlers are scoped by `tenantId` in the `where` AND by the tenant-scope
 * extension (`seo_redirects` is in `tenantScopedModels`); `findFirst` with flat
 * fields rather than a compound-unique `findUnique`, which the extension's
 * rewrite cannot carry.
 */

const ROUTE = "/api/tenant-admin/seo/redirects/[id]";

const updateSchema = z
  .object({
    toPath: z.string().min(1).max(SEO_REDIRECT_MAX_PATH_LENGTH),
    statusCode: z
      .union([
        z.literal(SEO_REDIRECT_STATUS_CODES[0]),
        z.literal(SEO_REDIRECT_STATUS_CODES[1]),
      ])
      .optional(),
  })
  .strict();

function notFound(route: string): NextResponse {
  return apiError(new Error("Redirect not found"), {
    route,
    status: 404,
    safeMessage: "Redirect not found",
  });
}

export const PUT = requirePermissionParams(
  "canEditSeo",
  requireFeature(FEATURES.SEO_PRO, async (request, { tenantId }, params) => {
    const existing: { id: string; fromPath: string } | null =
      await prisma.seo_redirects.findFirst({
        where: { id: params.id, tenantId },
        select: { id: true, fromPath: true },
      });
    if (!existing) return notFound(`PUT ${ROUTE}`);

    let parsed;
    try {
      parsed = await parseJsonBody(request, updateSchema);
    } catch (error) {
      return apiError(error, { route: `PUT ${ROUTE}` });
    }

    const check = await checkRedirectWrite(
      tenantId,
      { fromPath: existing.fromPath, toPath: parsed.toPath },
      existing.id,
    );
    if (!check.ok) {
      return NextResponse.json(
        {
          error: REDIRECT_REJECTION_MESSAGES[check.reason],
          code: check.reason,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.seo_redirects.update({
      where: { id: existing.id },
      data: {
        toPath: check.value.toPath,
        ...(parsed.statusCode ? { statusCode: parsed.statusCode } : {}),
      },
      select: {
        id: true,
        fromPath: true,
        toPath: true,
        statusCode: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ redirect: updated });
  }),
);

export const DELETE = requirePermissionParams(
  "canEditSeo",
  requireFeature(FEATURES.SEO_PRO, async (_request, { tenantId }, params) => {
    const existing: { id: string } | null =
      await prisma.seo_redirects.findFirst({
        where: { id: params.id, tenantId },
        select: { id: true },
      });
    if (!existing) return notFound(`DELETE ${ROUTE}`);

    await prisma.seo_redirects.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  }),
);
