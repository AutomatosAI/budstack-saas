/**
 * Platform US-019 — the redirect bookkeeping a budstacks.io blog rename does.
 *
 * THE PLAN IS NOT REIMPLEMENTED HERE. `planSlugRenameRedirect`
 * (lib/seo/slug-redirects.ts) is pure and already decides all three steps a
 * rename needs — delete a rule claiming the new path, re-aim rules pointing at
 * the old one, then write or retarget the old → new rule — and its module
 * docstring is where the reasoning for that order lives. This file is the same
 * plan applied to `platform_seo_redirects` instead of `seo_redirects`, and the
 * only difference between the two is that there is no tenant to scope by.
 *
 * WHY A SECOND TABLE AT ALL: `seo_redirects.tenantId` is NOT NULL with an FK to
 * `tenants`, and the model sits in `tenantScopedModels` (lib/db.ts). A
 * null-tenant row would be filtered out by the `$extends` rewrite on every read
 * and would not be deduplicated by `@@unique([tenantId, fromPath])`, because
 * Postgres treats NULLs in a unique index as distinct. See the migration
 * (20260816030000_add_platform_seo_redirects) for the same note in SQL.
 *
 * NO PLAN GATE, unlike the tenant path. Entitlements describe what a customer
 * bought; the platform is not a customer of itself, so a rename here always
 * earns its 301.
 *
 * NOT ATOMIC, for the same reason the tenant module is not: this repo has no
 * `$transaction` call site, the writes run AFTER the post has already been
 * renamed, each is idempotent, and re-running the same rename is a no-op. A
 * write that throws is logged and reported as `write_failed` — it never fails
 * the edit, because a post the author successfully renamed must not 500 on its
 * way back.
 *
 * The paths handed in are always `/blog/{slug}` (`blogPostPath`), a constant
 * prefix rather than user input, so `isReservedRedirectPath` cannot fire on
 * them and is not re-checked — the tenant module makes the same call.
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SEO_REDIRECT_DEFAULT_STATUS } from "./redirects";
import {
  planSlugRenameRedirect,
  skippedSlugRedirect,
  type ExistingRedirectRow,
  type SlugRedirectOutcome,
} from "./slug-redirects";

/**
 * Apply the rename plan to the platform table.
 *
 * The row annotation is not decoration: the `prisma` export in lib/db.ts is
 * any-widened (the build-time mock is a Proxy), so an inferred result makes
 * every downstream callback an implicit `any` and trips TS7006.
 *
 * The cap `planSlugRenameRedirect` enforces is `SEO_REDIRECT_MAX_PER_TENANT`.
 * Its name says tenant; the constraint it encodes is per REDIRECT TABLE —
 * middleware caches the whole table in memory and matches against it there, so
 * it has to stay complete — and that applies to this table identically.
 */
export async function applyPlatformSlugRenameRedirect(input: {
  oldPath: string;
  newPath: string;
}): Promise<SlugRedirectOutcome> {
  try {
    const rows: ExistingRedirectRow[] =
      await prisma.platform_seo_redirects.findMany({
        select: { id: true, fromPath: true, toPath: true },
      });

    const decision = planSlugRenameRedirect(rows, input);
    if (!decision.ok) return skippedSlugRedirect(decision.reason);

    const { fromPath, toPath, deleteIds, repointIds, retargetId } = decision.plan;

    if (deleteIds.length > 0) {
      await prisma.platform_seo_redirects.deleteMany({
        where: { id: { in: [...deleteIds] } },
      });
    }

    if (repointIds.length > 0) {
      await prisma.platform_seo_redirects.updateMany({
        where: { id: { in: [...repointIds] } },
        data: { toPath },
      });
    }

    if (retargetId) {
      // `statusCode` is left as it was stored: the rename is a change of
      // destination, not of kind.
      await prisma.platform_seo_redirects.update({
        where: { id: retargetId },
        data: { toPath },
      });
    } else {
      await prisma.platform_seo_redirects.create({
        data: { fromPath, toPath, statusCode: SEO_REDIRECT_DEFAULT_STATUS },
      });
    }

    return {
      redirected: true,
      repointed: repointIds.length,
      replaced: deleteIds.length,
    };
  } catch (error) {
    // The post has already been renamed by the time this runs. Reporting the
    // failure beats failing the request the author's edit arrived in.
    logger.error("[seo] platform slug rename redirect failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return skippedSlugRedirect("write_failed");
  }
}
