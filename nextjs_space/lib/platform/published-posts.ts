import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  PLATFORM_POST_SUMMARY_SELECT,
  type PlatformPostSummary,
} from "@/lib/platform/posts";

/**
 * US-008 — the PUBLIC read side of `platform_posts` (budstacks.io/blog).
 *
 * A separate module from `lib/platform/posts.ts` on purpose. That one holds the
 * write contract and the row types, and it is imported by the super-admin
 * editor — a CLIENT component — so nothing in it may reach Prisma or pino.
 * Everything here does, which makes this module server-only by construction.
 *
 * NO TENANT APPEARS IN ANY PREDICATE BELOW. `platform_posts` is deliberately
 * absent from `tenantScopedModels` (lib/db.ts); that Set is an OPT-IN allowlist,
 * and joining it would weld a tenant filter onto the apex query and empty the
 * blog for every visitor.
 */

/**
 * Thrown when the query itself failed — as distinct from succeeding with no
 * rows. The wording is deliberately free of driver, host and SQL detail: in
 * development Next.js prints a server component's error message on the error
 * page, and "cannot reach postgres-…:5432" is not a fact for a reader.
 */
export const BLOG_UNAVAILABLE_MESSAGE =
  "The blog could not be loaded right now.";

/**
 * Published posts, newest first — the public index's only query.
 *
 * AN OUTAGE MUST NOT RENDER AS AN EMPTY BLOG. Once the result is an array, a
 * zero-row answer and an unreachable database are indistinguishable, so the
 * failure is logged and RE-THROWN rather than caught into `[]`. A visitor then
 * gets a 500, which is true, instead of a 200 page stating that budstacks.io
 * has never published anything — and a crawler is told to come back rather than
 * being handed an empty index to remember.
 *
 * This is the opposite call from `app/sitemap.ts`, which swallows the same
 * failure on purpose: there, one missing section costs freshness, where a
 * sitemap that 500s teaches a crawler the whole site is broken. Here the failed
 * section IS the page.
 *
 * `publishedAt` is NULLS LAST defensively. The write routes stamp it on the
 * transition into published (`resolvePublishedAt`), so a live post always has
 * one; but Postgres sorts NULLs FIRST under `DESC`, so a row that somehow
 * lacked a date would lead the blog with a blank byline date.
 */
export async function loadPublishedPlatformPosts(): Promise<
  PlatformPostSummary[]
> {
  try {
    // Row type stated explicitly: the `prisma` export is any-widened (the
    // build-time client is a Proxy mock), so an inferred result would make
    // every downstream map callback an implicit `any` — TS7006.
    const posts: PlatformPostSummary[] = await prisma.platform_posts.findMany({
      where: { published: true },
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      // The article body is the one big column and no index card shows it.
      select: PLATFORM_POST_SUMMARY_SELECT,
    });

    return posts;
  } catch (error) {
    logger.error("[blog] published platform posts query failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    throw new Error(BLOG_UNAVAILABLE_MESSAGE);
  }
}
