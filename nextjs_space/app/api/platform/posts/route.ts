import { NextResponse } from "next/server";

import { withSuperAdmin } from "@/lib/api-auth";
import { apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  PLATFORM_POST_BODY_MAX_BYTES,
  PLATFORM_POST_SUMMARY_SELECT,
  UNDERIVABLE_SLUG_MESSAGE,
  duplicateSlugMessage,
  platformPostCreateSchema,
  platformPostValidationMessage,
  resolveCreateSlug,
  resolvePublishedAt,
  type PlatformPostRow,
  type PlatformPostSummary,
} from "@/lib/platform/posts";
import { readEntitySeo, isEmptyEntitySeo } from "@/lib/seo/entity-seo";
import { sanitizePostHtml } from "@/lib/security/post-sanitize";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * The budstacks.io blog, authored by the platform team.
 *
 * SUPER-ADMIN ONLY. The sibling route `app/api/platform/leads` is deliberately
 * unauthenticated — a prospect filling in the homepage CTA has no account — and
 * it is the only other route under `app/api/platform/`. It is NOT the model for
 * this one: copying its shape would ship an unauthenticated write API for the
 * platform's published content. These are the first `/api/platform/*` routes to
 * use the super-admin wrappers.
 *
 * Note on the refusal status: `withSuperAdmin` answers a signed-in tenant admin
 * with 401 (lib/api-auth.ts:155), which is the repo-wide convention across all
 * 44 super-admin routes. The story asks for 403; forking the shared wrapper for
 * one route family would be worse than the inconsistency. What matters — a
 * tenant admin cannot read or write platform posts — holds either way.
 */

const ROUTE_POST = "POST /api/platform/posts";

/** GET — every post, newest first, for the super-admin list. Body omitted. */
export const GET = withSuperAdmin(async () => {
  const posts: PlatformPostSummary[] = await prisma.platform_posts.findMany({
    orderBy: { createdAt: "desc" },
    select: PLATFORM_POST_SUMMARY_SELECT,
  });

  return NextResponse.json({ posts });
});

/** POST — create a post. A new post is a draft unless it says otherwise. */
export const POST = withSuperAdmin(async (req) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await parseJsonBody(req, undefined, {
      maxBytes: PLATFORM_POST_BODY_MAX_BYTES,
    });
  } catch (error) {
    return apiError(error, { route: ROUTE_POST });
  }

  const parsed = platformPostCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(
      platformPostValidationMessage(parsed.error),
      ROUTE_POST,
    );
  }
  const input = parsed.data;

  const slug = resolveCreateSlug({ slug: input.slug, title: input.title });
  if (!slug) {
    return apiValidationError(UNDERIVABLE_SLUG_MESSAGE, ROUTE_POST);
  }

  // Checked before the insert so the answer is the 409 the story asks for
  // rather than a raw Prisma error. The unique index is still the authority —
  // the P2002 catch below closes the gap between this read and the write.
  const existing: { id: string } | null =
    await prisma.platform_posts.findUnique({
      where: { slug },
      select: { id: true },
    });
  if (existing) {
    return apiError(new Error("Duplicate slug"), {
      route: ROUTE_POST,
      status: 409,
      safeMessage: duplicateSlugMessage(slug),
    });
  }

  const published = input.published ?? false;
  const authored = readEntitySeo(input.seo);

  try {
    const post: PlatformPostRow = await prisma.platform_posts.create({
      data: {
        slug,
        title: input.title,
        // Sanitised on the way IN and again on the way OUT: a row written
        // before a rules change still renders under the current policy.
        content: sanitizePostHtml(input.content),
        excerpt: input.excerpt || null,
        coverImage: input.coverImage || null,
        coverImageAlt: input.coverImageAlt || null,
        authorName: input.authorName,
        authorRole: input.authorRole || null,
        published,
        publishedAt: resolvePublishedAt({
          published,
          existingPublishedAt: null,
          now: new Date(),
        }),
        // The key is OMITTED rather than set to null when nothing was authored:
        // a bare `null` is not a legal value for a nullable Json column, and an
        // absent key leaves it at the SQL NULL default — the same end state.
        ...(isEmptyEntitySeo(authored) ? {} : { seo: authored }),
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    // P2002 = the unique index on `slug` fired between the check above and this
    // insert. Same answer as the pre-check, so a race reads as a taken slug and
    // not as a 500.
    if ((error as { code?: string })?.code === "P2002") {
      return apiError(error, {
        route: ROUTE_POST,
        status: 409,
        safeMessage: duplicateSlugMessage(slug),
      });
    }
    return apiError(error, { route: ROUTE_POST });
  }
});
