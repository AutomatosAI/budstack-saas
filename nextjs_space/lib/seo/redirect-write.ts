/**
 * SEO Supercharge US-020 — the checks a redirect write must pass, in one place
 * so the create route and the retarget route cannot disagree.
 *
 * SERVER ONLY (it reads the database). The rules it applies are all pure and
 * live in `./redirects`, which middleware also imports; this module is only the
 * part that needs to see the tenant's other rows.
 */

import { prisma } from "@/lib/db";
import {
  findRedirectChainProblem,
  isReservedRedirectPath,
  normalizeRedirectPath,
  redirectMatchKey,
  SEO_REDIRECT_MAX_PER_TENANT,
  type SeoRedirectRule,
} from "./redirects";

export type RedirectWriteRejection =
  | "invalid_from"
  | "invalid_to"
  | "reserved_from"
  | "self_redirect"
  | "loop"
  | "limit_reached";

/** One sentence per rejection, written for the owner rather than the log. */
export const REDIRECT_REJECTION_MESSAGES: Record<
  RedirectWriteRejection,
  string
> = {
  invalid_from:
    "Enter the old path as it appears after your domain, for example /old-page.",
  invalid_to:
    "Enter the new path as it appears after your domain, for example /new-page. Links to other websites are not supported.",
  reserved_from:
    "That path is reserved by the platform and cannot be redirected.",
  self_redirect: "A path cannot redirect to itself.",
  loop: "That would create a redirect loop — the destination leads back here.",
  limit_reached: `A store can hold ${SEO_REDIRECT_MAX_PER_TENANT} redirects. Delete one before adding another.`,
};

export interface NormalizedRedirect {
  /** Normalised and lower-cased — the stored key. */
  readonly fromPath: string;
  /** Normalised, case preserved. */
  readonly toPath: string;
}

export type RedirectWriteCheck =
  | { readonly ok: true; readonly value: NormalizedRedirect }
  | { readonly ok: false; readonly reason: RedirectWriteRejection };

/**
 * Validate a redirect against this tenant's existing table.
 *
 * `replacingId` is the row being retargeted, excluded from BOTH the count and
 * the loop chain: an edit is not a new row, and a rule cannot conflict with the
 * version of itself it is replacing.
 *
 * The duplicate check is NOT here — it belongs to the unique index
 * (`seo_redirects_tenantId_fromPath_key`), which two concurrent creates cannot
 * both slip past the way they can slip past a read-then-write.
 */
export async function checkRedirectWrite(
  tenantId: string,
  input: { fromPath: unknown; toPath: unknown },
  replacingId?: string,
): Promise<RedirectWriteCheck> {
  const fromPath = redirectMatchKey(input.fromPath);
  if (!fromPath) return { ok: false, reason: "invalid_from" };
  if (isReservedRedirectPath(fromPath)) {
    return { ok: false, reason: "reserved_from" };
  }

  const toPath = normalizeRedirectPath(input.toPath);
  if (!toPath) return { ok: false, reason: "invalid_to" };

  // The explicit row annotation is required: lib/db.ts's `prisma` export is
  // any-widened by the build-time mock Proxy, so generics do not flow and an
  // inferred element type trips TS7006.
  const existing: Array<{ id: string; fromPath: string; toPath: string }> =
    await prisma.seo_redirects.findMany({
      where: { tenantId },
      select: { id: true, fromPath: true, toPath: true },
    });

  const others = existing.filter((row) => row.id !== replacingId);

  if (!replacingId && others.length >= SEO_REDIRECT_MAX_PER_TENANT) {
    return { ok: false, reason: "limit_reached" };
  }

  const chain: SeoRedirectRule[] = others.map((row) => ({
    fromPath: row.fromPath,
    toPath: row.toPath,
    statusCode: 301,
  }));

  const problem = findRedirectChainProblem(chain, { fromPath, toPath });
  if (problem) return { ok: false, reason: problem };

  return { ok: true, value: { fromPath, toPath } };
}
