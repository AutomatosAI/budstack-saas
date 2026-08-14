/**
 * SEO Supercharge US-021 — the redirect bookkeeping a rename does.
 *
 * A Wire post's URL is its slug. Renaming one used to be silent data loss: the
 * old URL — the one in every share, every backlink and every crawler's index —
 * started 404ing the moment the post moved, and nothing recorded where it went.
 * This module is what a Pro rename does instead, in one pass:
 *
 *   1. DELETE any rule that CLAIMS the new path. Middleware redirects before
 *      routing (middleware.ts:136-161), so a rule on the post's new URL makes
 *      the renamed post unreachable at the address it was just given. This is
 *      the rename-back case — /a → /b leaves "/a redirects to /b" behind, and
 *      renaming /b back to /a must clear it or the post disappears.
 *   2. RE-AIM every rule that POINTS AT the old path at the new one. Without
 *      this, an earlier rename leaves /old → /middle → /new: two hops, a
 *      diluted signal, and one more thing to break. Replace, never stack —
 *      the same discipline the campaign scheduler applies to its re-runs.
 *   3. WRITE the old path → new path rule itself, or retarget the rule already
 *      sitting on the old path (again: replace, never stack).
 *
 * ORDER 1→3 IS WHAT MAKES A LOOP IMPOSSIBLE rather than merely unlikely. After
 * (1) nothing maps FROM the new path — `@@unique([tenantId, fromPath])` allows
 * only one rule per path and every such rule has just been deleted — so the new
 * rule's destination is the end of its chain. `findRedirectChainProblem` still
 * runs over the planned end-state before anything is written, because a
 * constructive argument is not a guarantee and the failure it prevents is
 * ERR_TOO_MANY_REDIRECTS on the owner's own storefront.
 *
 * PRO ONLY, decided by the CALLER (the entitlement lives on the route, not
 * here). A Basic rename still succeeds — post editing is not a Pro feature —
 * it just leaves the old URL 404ing, which the editor says out loud before the
 * owner saves.
 *
 * NOT ATOMIC. This repo has no `$transaction` call site, and the alternative
 * (introducing interactive transactions under the `$extends` tenant-scope
 * rewrite) is a larger change than the failure justifies: the writes run after
 * the post is already renamed, each is idempotent, and the whole plan converges
 * if it is re-run — a second save of the same slug is a no-op. A write that
 * throws is logged and reported as `write_failed`; it never fails the edit,
 * because a post the owner successfully renamed must not 500 on its way back.
 *
 * The paths this module is handed are always `/the-wire/{slug}`
 * (`wirePostPath`), so `isReservedRedirectPath` cannot fire on them and is not
 * re-checked here — the prefix is a constant, not user input.
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  findRedirectChainProblem,
  normalizeRedirectPath,
  redirectMatchKey,
  SEO_REDIRECT_DEFAULT_STATUS,
  SEO_REDIRECT_MAX_PER_TENANT,
  type SeoRedirectRule,
} from "./redirects";

/** The columns the plan is computed from. */
export interface ExistingRedirectRow {
  readonly id: string;
  readonly fromPath: string;
  readonly toPath: string;
}

/** Why the old URL did NOT end up redirecting. Each is reported, never hidden. */
export type SlugRedirectSkip =
  /** The tenant is on Basic — the editor warned before the save. */
  | "not_entitled"
  /** A path the redirect table cannot hold (empty slug, traversal, a scheme). */
  | "invalid_path"
  /** The tenant is at `SEO_REDIRECT_MAX_PER_TENANT` and must delete one first. */
  | "limit_reached"
  /** The planned end-state would loop. Constructively impossible; still checked. */
  | "loop"
  /** A write threw. The rename itself already succeeded. */
  | "write_failed";

export interface SlugRedirectOutcome {
  /** Does the old path now redirect to the new one? */
  readonly redirected: boolean;
  readonly reason?: SlugRedirectSkip;
  /** Rules that pointed at the old path and were re-aimed at the new one. */
  readonly repointed: number;
  /** Rules deleted because they claimed the new path and would have shadowed it. */
  readonly replaced: number;
}

/** The one shape for "nothing was written, and here is why". */
export function skippedSlugRedirect(reason: SlugRedirectSkip): SlugRedirectOutcome {
  return { redirected: false, reason, repointed: 0, replaced: 0 };
}

export interface SlugRedirectPlan {
  /** Normalised and lower-cased — the stored key. */
  readonly fromPath: string;
  /** Normalised, case preserved. */
  readonly toPath: string;
  /** Rules claiming the new path — deleted (step 1). */
  readonly deleteIds: readonly string[];
  /** Rules aimed at the old path — re-aimed (step 2). */
  readonly repointIds: readonly string[];
  /** A rule already on the old path — retargeted instead of a second row (step 3). */
  readonly retargetId: string | null;
}

export type SlugRedirectDecision =
  | { readonly ok: true; readonly plan: SlugRedirectPlan }
  | { readonly ok: false; readonly reason: SlugRedirectSkip };

/**
 * Decide, without touching the database, what the rename does to this tenant's
 * redirect table. Pure — every rule above is asserted against this function.
 */
export function planSlugRenameRedirect(
  rows: readonly ExistingRedirectRow[],
  input: { oldPath: string; newPath: string },
): SlugRedirectDecision {
  const fromPath = redirectMatchKey(input.oldPath);
  const toPath = normalizeRedirectPath(input.newPath);
  const toKey = redirectMatchKey(input.newPath);
  if (!fromPath || !toPath || !toKey || fromPath === toKey) {
    return { ok: false, reason: "invalid_path" };
  }

  const deleteIds: string[] = [];
  const repointIds: string[] = [];
  let retargetId: string | null = null;

  for (const row of rows) {
    const rowFrom = redirectMatchKey(row.fromPath);
    if (!rowFrom) continue;

    // Order is exclusive by construction: `fromPath` is unique per tenant, so a
    // row is at most one of "claims the new path", "is the old path's rule" and
    // "points at the old path".
    if (rowFrom === toKey) {
      deleteIds.push(row.id);
    } else if (rowFrom === fromPath) {
      retargetId = row.id;
    } else if (redirectMatchKey(row.toPath) === fromPath) {
      repointIds.push(row.id);
    }
  }

  // Retargeting an existing row adds nothing to the table, so only a genuine
  // insert can hit the cap. Deletions from step 1 make room first.
  if (!retargetId && rows.length - deleteIds.length >= SEO_REDIRECT_MAX_PER_TENANT) {
    return { ok: false, reason: "limit_reached" };
  }

  const dropped = new Set(deleteIds);
  const repointed = new Set(repointIds);
  const endState: SeoRedirectRule[] = rows
    .filter((row) => !dropped.has(row.id) && row.id !== retargetId)
    .map((row) => ({
      fromPath: row.fromPath,
      toPath: repointed.has(row.id) ? toPath : row.toPath,
      statusCode: SEO_REDIRECT_DEFAULT_STATUS,
    }));

  if (findRedirectChainProblem(endState, { fromPath, toPath })) {
    return { ok: false, reason: "loop" };
  }

  return { ok: true, plan: { fromPath, toPath, deleteIds, repointIds, retargetId } };
}

/**
 * Apply the plan. Tenant-scoped in every `where` AND by the extension in
 * lib/db.ts (`seo_redirects` is in `tenantScopedModels`).
 *
 * The row annotations are not decoration: that file's `prisma` export is
 * any-widened by the build-time mock Proxy, so generics do not flow and an
 * inferred result trips TS7006.
 */
export async function applySlugRenameRedirect(input: {
  tenantId: string;
  oldPath: string;
  newPath: string;
}): Promise<SlugRedirectOutcome> {
  try {
    const rows: ExistingRedirectRow[] = await prisma.seo_redirects.findMany({
      where: { tenantId: input.tenantId },
      select: { id: true, fromPath: true, toPath: true },
    });

    const decision = planSlugRenameRedirect(rows, input);
    if (!decision.ok) return skippedSlugRedirect(decision.reason);

    const { fromPath, toPath, deleteIds, repointIds, retargetId } = decision.plan;

    if (deleteIds.length > 0) {
      await prisma.seo_redirects.deleteMany({
        where: { tenantId: input.tenantId, id: { in: [...deleteIds] } },
      });
    }

    if (repointIds.length > 0) {
      await prisma.seo_redirects.updateMany({
        where: { tenantId: input.tenantId, id: { in: [...repointIds] } },
        data: { toPath },
      });
    }

    if (retargetId) {
      // `statusCode` is left as the owner set it — they may have chosen 308 on
      // purpose, and the rename is a change of destination, not of kind.
      await prisma.seo_redirects.update({
        where: { id: retargetId },
        data: { toPath },
      });
    } else {
      await prisma.seo_redirects.create({
        data: {
          tenantId: input.tenantId,
          fromPath,
          toPath,
          statusCode: SEO_REDIRECT_DEFAULT_STATUS,
        },
      });
    }

    return {
      redirected: true,
      repointed: repointIds.length,
      replaced: deleteIds.length,
    };
  } catch (error) {
    // The post has already been renamed at this point. Reporting the failure
    // beats failing the request the owner's edit arrived in.
    logger.error("[seo] slug rename redirect failed", {
      tenantId: input.tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return skippedSlugRedirect("write_failed");
  }
}
