import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  checkRedirectWrite,
  REDIRECT_REJECTION_MESSAGES,
} from "@/lib/seo/redirect-write";
import {
  SEO_REDIRECT_DEFAULT_STATUS,
  SEO_REDIRECT_MAX_PATH_LENGTH,
  SEO_REDIRECT_STATUS_CODES,
} from "@/lib/seo/redirects";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * SEO Supercharge US-020 — the redirects an owner manages.
 *
 * TWO GATES, COMPOSED. `requirePermission` answers "may this MEMBER"; the
 * `requireFeature` inside it answers "may this TENANT". Both must pass on a
 * write, in that order, so an unauthorised caller is refused before the plan
 * lookup runs and never learns the store's plan
 * (lib/entitlements/require-feature.ts).
 *
 * THE READ IS NOT PLAN-GATED, deliberately. A tenant who drops to Basic keeps
 * their rules — dormant, still listed, still deletable — and gets them back on
 * upgrade. Hiding them behind the plan would make a downgrade look like data
 * loss, and the rows are the owner's own work. The dormancy is enforced where it
 * matters, in the public feed that middleware reads.
 */

const ROUTE = "/api/tenant-admin/seo/redirects";

const createSchema = z
  .object({
    fromPath: z.string().min(1).max(SEO_REDIRECT_MAX_PATH_LENGTH),
    toPath: z.string().min(1).max(SEO_REDIRECT_MAX_PATH_LENGTH),
    // The shape check only; the value rules (normalisation, reserved paths,
    // loops) live in checkRedirectWrite so both write routes share them.
    statusCode: z
      .union([z.literal(SEO_REDIRECT_STATUS_CODES[0]), z.literal(SEO_REDIRECT_STATUS_CODES[1])])
      .optional(),
  })
  .strict();

export const GET = requirePermission("canViewSeo", async (_request, { tenantId }) => {
  const redirects: Array<{
    id: string;
    fromPath: string;
    toPath: string;
    statusCode: number;
    createdAt: Date;
  }> = await prisma.seo_redirects.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      statusCode: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ redirects });
});

export const POST = requirePermission(
  "canEditSeo",
  requireFeature(FEATURES.SEO_PRO, async (request, { tenantId }) => {
    let parsed;
    try {
      parsed = await parseJsonBody(request, createSchema);
    } catch (error) {
      return apiError(error, { route: `POST ${ROUTE}` });
    }

    const check = await checkRedirectWrite(tenantId, parsed);
    if (!check.ok) {
      return NextResponse.json(
        {
          error: REDIRECT_REJECTION_MESSAGES[check.reason],
          code: check.reason,
        },
        { status: 400 },
      );
    }

    try {
      const created = await prisma.seo_redirects.create({
        data: {
          tenantId,
          fromPath: check.value.fromPath,
          toPath: check.value.toPath,
          statusCode: parsed.statusCode ?? SEO_REDIRECT_DEFAULT_STATUS,
        },
        select: {
          id: true,
          fromPath: true,
          toPath: true,
          statusCode: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ redirect: created }, { status: 201 });
    } catch (error) {
      // The unique index is the duplicate check — a read-then-write here would
      // let two concurrent saves both pass and one of them explode anyway.
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          {
            error: "That path already redirects somewhere. Edit or delete the existing rule.",
            code: "duplicate_from",
          },
          { status: 409 },
        );
      }
      return apiError(error, {
        route: `POST ${ROUTE}`,
        safeMessage: "Could not save that redirect",
      });
    }
  }),
);

/** Prisma's unique-constraint code, read without importing the runtime enum. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
