import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { withSuperAdminParams } from "@/lib/api-auth";
import { apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  PLATFORM_POST_BODY_MAX_BYTES,
  PUBLISHED_SLUG_LOCKED_MESSAGE,
  duplicateSlugMessage,
  platformPostUpdateSchema,
  platformPostValidationMessage,
  resolvePublishedAt,
  type PlatformPostRow,
} from "@/lib/platform/posts";
import {
  readEntitySeo,
  isEmptyEntitySeo,
  type EntitySeo,
} from "@/lib/seo/entity-seo";
import { sanitizePostHtml } from "@/lib/security/post-sanitize";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { parseJsonBody } from "@/lib/validation/body";
import { parseUuid } from "@/lib/validation/parse-uuid";

/**
 * One platform post: read, edit, publish, delete. SUPER-ADMIN ONLY.
 *
 * See `app/api/platform/posts/route.ts` for why the unauthenticated
 * `app/api/platform/leads` route is not the model for this file, and for the
 * note on the wrapper's 401-vs-403 refusal status.
 */

const ROUTE_GET = "GET /api/platform/posts/[id]";
const ROUTE_PATCH = "PATCH /api/platform/posts/[id]";
const ROUTE_DELETE = "DELETE /api/platform/posts/[id]";

/** The row an edit reasons about, before anything is written. */
type ExistingPost = Pick<
  PlatformPostRow,
  "id" | "slug" | "published" | "publishedAt" | "seo"
>;

const EXISTING_SELECT = {
  id: true,
  slug: true,
  published: true,
  publishedAt: true,
  seo: true,
} as const;

/**
 * The columns an edit may set, declared here rather than borrowed from
 * `Prisma.platform_postsUpdateInput`.
 *
 * Both give column-name and value-type checking; this one also accepts an
 * `EntitySeo` for the Json column. The generated input type wants an
 * `InputJsonObject`, and `EntitySeo` is an INTERFACE, which TypeScript will not
 * treat as index-signature compatible — assigning one needs a cast, and a cast
 * is exactly the check worth keeping. Fields mirror `PlatformPostRow`.
 */
type PlatformPostUpdateData = Partial<{
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  authorName: string;
  authorRole: string | null;
  published: boolean;
  publishedAt: Date | null;
  seo: EntitySeo | typeof Prisma.DbNull;
}>;

function notFound(route: string): NextResponse {
  return apiError(new Error("Post not found"), {
    route,
    status: 404,
    safeMessage: "Post not found",
  });
}

/** GET — the full post, body included, for the editor to load. */
export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  const id = parseUuid(params.id);

  const post: PlatformPostRow | null = await prisma.platform_posts.findUnique({
    where: { id },
  });

  if (!post) return notFound(ROUTE_GET);

  return NextResponse.json({ post });
});

/** PATCH — edit. An absent key leaves that column alone. */
export const PATCH = withSuperAdminParams(async (req, _ctx, params) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const id = parseUuid(params.id);

  let body: unknown;
  try {
    body = await parseJsonBody(req, undefined, {
      maxBytes: PLATFORM_POST_BODY_MAX_BYTES,
    });
  } catch (error) {
    return apiError(error, { route: ROUTE_PATCH });
  }

  const parsed = platformPostUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(
      platformPostValidationMessage(parsed.error),
      ROUTE_PATCH,
    );
  }
  const input = parsed.data;

  const existing: ExistingPost | null = await prisma.platform_posts.findUnique({
    where: { id },
    select: EXISTING_SELECT,
  });
  if (!existing) return notFound(ROUTE_PATCH);

  const data: PlatformPostUpdateData = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) data.content = sanitizePostHtml(input.content);
  if (input.excerpt !== undefined) data.excerpt = input.excerpt || null;
  if (input.coverImage !== undefined) data.coverImage = input.coverImage || null;
  if (input.coverImageAlt !== undefined) {
    data.coverImageAlt = input.coverImageAlt || null;
  }
  if (input.authorName !== undefined) data.authorName = input.authorName;
  if (input.authorRole !== undefined) data.authorRole = input.authorRole || null;

  if (input.seo !== undefined) {
    const authored = readEntitySeo(input.seo);
    // DbNull, not a bare null: `null` is not a legal value for a nullable Json
    // column, and JsonNull would store the JSON literal `null` and leave a
    // non-NULL row behind.
    data.seo = isEmptyEntitySeo(authored) ? Prisma.DbNull : authored;
  }

  // A rename is refused while the post is live. US-019 adds the automatic 301
  // that makes it safe; until then the old URL would simply 404 and every
  // inbound link to it would be discarded. Refused server-side, not only in the
  // editor, so an API caller cannot route around the form's warning.
  if (input.slug !== undefined && input.slug !== existing.slug) {
    if (existing.published) {
      return apiError(new Error("Published slug is locked"), {
        route: ROUTE_PATCH,
        status: 409,
        safeMessage: PUBLISHED_SLUG_LOCKED_MESSAGE,
      });
    }

    const clash: { id: string } | null = await prisma.platform_posts.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      return apiError(new Error("Duplicate slug"), {
        route: ROUTE_PATCH,
        status: 409,
        safeMessage: duplicateSlugMessage(input.slug),
      });
    }

    data.slug = input.slug;
  }

  if (input.published !== undefined) {
    data.published = input.published;
    data.publishedAt = resolvePublishedAt({
      published: input.published,
      existingPublishedAt: existing.publishedAt,
      now: new Date(),
    });
  }

  try {
    const post: PlatformPostRow = await prisma.platform_posts.update({
      where: { id },
      data,
    });

    return NextResponse.json({ post });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    // P2002 = the unique index fired between the clash check and this write.
    if (code === "P2002") {
      return apiError(error, {
        route: ROUTE_PATCH,
        status: 409,
        safeMessage: duplicateSlugMessage(input.slug ?? existing.slug),
      });
    }
    // P2025 = the row was deleted between the read and the update.
    if (code === "P2025") return notFound(ROUTE_PATCH);
    return apiError(error, { route: ROUTE_PATCH });
  }
});

/** DELETE — remove a post outright. */
export const DELETE = withSuperAdminParams(async (req, _ctx, params) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const id = parseUuid(params.id);

  try {
    await prisma.platform_posts.delete({ where: { id } });
  } catch (error) {
    // P2025 = no row with that id. A delete that found nothing is a 404, not a
    // 500 — and not a silent success, which would tell the list it worked.
    if ((error as { code?: string })?.code === "P2025") {
      return notFound(ROUTE_DELETE);
    }
    return apiError(error, { route: ROUTE_DELETE });
  }

  return NextResponse.json({ success: true });
});
