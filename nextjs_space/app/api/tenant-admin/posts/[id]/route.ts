import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { getTenantPlan } from "@/lib/entitlements/require-feature";
import { withEntityImageAlt } from "@/lib/seo/entity-seo";
import {
  normalizePostSlug,
  POST_SLUG_HINT,
  POST_SLUG_MAX_LENGTH,
  slugifyPostTitle,
} from "@/lib/seo/post-slug";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import {
  applySlugRenameRedirect,
  skippedSlugRedirect,
  type SlugRedirectOutcome,
} from "@/lib/seo/slug-redirects";
import { wirePostPath } from "@/lib/seo/wire-paths";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  content: z.string().min(1, "Content is required").max(100_000),
  excerpt: z.string().max(5000).optional(),
  coverImage: z.string().max(2000).optional(),
  // US-009 — NOT a column: this is the editor's name for `posts.seo.imageAlt`,
  // translated below. It must never reach `data` or Prisma throws on an unknown
  // field.
  coverImageAlt: z.string().max(300).optional(),
  // US-021 — the post's URL, editable at last. Shape only: the value rules live
  // in `normalizePostSlug` so the editor and this route cannot disagree about
  // what a slug is.
  slug: z.string().min(1).max(POST_SLUG_MAX_LENGTH).optional(),
  published: z.boolean().default(false),
});

/**
 * US-021 — the 301 a rename earns, or the reason it did not.
 *
 * The PLAN GATE IS HERE rather than around the route, and that is the whole
 * design: editing a post is Basic functionality and must never 403, so the
 * feature being gated is the redirect itself. A Basic rename succeeds and
 * reports `not_entitled`, which is what the editor warned about before the
 * owner saved. Gating the route would lock the wrong thing; gating nothing
 * would hand Pro away in the UI's blind spot.
 *
 * `getTenantPlan` reads the authoritative `tenants.plan` column and fails
 * closed to Basic, so a database blip skips the redirect rather than writing
 * one for a tenant who is not paying for it.
 */
async function redirectRename(
  tenantId: string,
  fromSlug: string,
  toSlug: string,
): Promise<SlugRedirectOutcome> {
  const plan = await getTenantPlan(tenantId);
  if (!isSeoProUnlocked({ id: tenantId, plan })) {
    return skippedSlugRedirect("not_entitled");
  }

  return applySlugRenameRedirect({
    tenantId,
    oldPath: wirePostPath(fromSlug),
    newPath: wirePostPath(toSlug),
  });
}

export const GET = withAuth(async (_req, { user }, { id: rawId }) => {
  try {
    const email = user.email;
    const role = user.role;

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return apiError(new Error("Unauthorized"), { route: "GET /api/tenant-admin/posts/[id]", status: 401, safeMessage: "Unauthorized" });
    }

    const id = parseUuid(rawId);

    // Relation on posts is `users` (introspected name) — `author` does not
    // exist and threw P2009, 500ing this route. Aliased in the response below.
    const post = await prisma.posts.findUnique({
      where: { id },
      include: { users: { select: { name: true } } },
    });

    if (!post) {
      return apiError(new Error("Post not found"), { route: "GET /api/tenant-admin/posts/[id]", status: 404, safeMessage: "Post not found" });
    }

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    // Super Admin can access all posts, Tenant Admin only their own
    if (role !== "SUPER_ADMIN" && post.tenantId !== localUser?.tenantId) {
      return apiError(new Error("Unauthorized"), { route: "GET /api/tenant-admin/posts/[id]", status: 403, safeMessage: "Unauthorized" });
    }

    const { users: author, ...rest } = post;
    return NextResponse.json({ ...rest, author });
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/posts/[id]" });
  }
});

export const PATCH = withAuth(async (req, { user }, { id: rawId }) => {
  try {
    const email = user.email;
    const role = user.role;

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return apiError(new Error("Unauthorized"), { route: "PATCH /api/tenant-admin/posts/[id]", status: 401, safeMessage: "Unauthorized" });
    }

    const id = parseUuid(rawId);
    const body = await parseJsonBody(req, undefined, { maxBytes: 512 * 1024 });
    const validatedData = postSchema.partial().parse(body);

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    const existingPost = await prisma.posts.findUnique({ where: { id } });

    // Allow SUPER_ADMIN to bypass tenant check, otherwise enforce ownership
    if (
      !existingPost ||
      (role !== "SUPER_ADMIN" && existingPost.tenantId !== localUser?.tenantId)
    ) {
      return apiError(new Error("Post not found or unauthorized"), { route: "PATCH /api/tenant-admin/posts/[id]", status: 404, safeMessage: "Post not found or unauthorized" });
    }

    // US-009: `coverImageAlt` is an alias for `posts.seo.imageAlt`, so it is
    // lifted OUT of the column payload and merged into the Json blob. The merge
    // is what keeps the SEO Manager's title/description/ogImage for this post
    // alive — it writes the same column through a different route. Absent from
    // the body (any caller that predates this field) means "leave seo alone".
    // `slug` is lifted out with `coverImageAlt`: both need work before they can
    // become column values, and spreading the raw body would write an
    // un-normalised slug straight into the URL.
    const { coverImageAlt, slug: requestedSlug, ...columnData } = validatedData;
    const dataToUpdate: Record<string, unknown> = { ...columnData };

    if (coverImageAlt !== undefined) {
      // DbNull, not a bare null: `null` is not a legal value for a nullable
      // Json column (lib/email/email-template-content.ts:93-94), and JsonNull
      // would store the JSON literal `null` — which `readEntitySeo` treats as
      // authored-nothing anyway, but leaves a non-NULL row behind.
      dataToUpdate.seo =
        withEntityImageAlt(existingPost.seo, coverImageAlt) ?? Prisma.DbNull;
    }

    // US-021 — an AUTHORED slug wins over the title-derived one. Once someone
    // has chosen a URL, retitling the article must not silently move it; that
    // was the old behaviour and it is exactly what a redirect manager exists to
    // undo. The derivation stays for callers that send no slug — the editor
    // before this story, and anything else PATCHing a title.
    const baseSlug =
      requestedSlug !== undefined
        ? normalizePostSlug(requestedSlug)
        : validatedData.title && validatedData.title !== existingPost.title
          ? slugifyPostTitle(validatedData.title)
          : null;

    if (requestedSlug !== undefined && !baseSlug) {
      return NextResponse.json({ error: POST_SLUG_HINT }, { status: 400 });
    }

    let renamedFrom: string | null = null;
    let renamedTo: string | null = null;

    if (baseSlug && baseSlug !== existingPost.slug) {
      let uniqueSlug = baseSlug;
      let counter = 1;
      while (
        await prisma.posts.findFirst({
          where: {
            slug: uniqueSlug,
            // Scope to the post's own tenant: a SUPER_ADMIN editing another
            // tenant's post must not key off their own tenantId. existingPost
            // is guaranteed non-null by the ownership check above.
            tenantId: existingPost.tenantId,
            NOT: { id },
          },
        })
      ) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter += 1;
      }
      dataToUpdate.slug = uniqueSlug;

      // The rename is only worth a redirect if there was a real URL to leave
      // behind AND the uniqueness loop did not land back on it.
      if (
        typeof existingPost.slug === "string" &&
        existingPost.slug &&
        existingPost.slug !== uniqueSlug
      ) {
        renamedFrom = existingPost.slug;
        renamedTo = uniqueSlug;
      }
    }

    const updatedPost = await prisma.posts.update({
      where: { id },
      data: dataToUpdate,
    });

    // AFTER the rename lands, never before: a redirect to a URL that failed to
    // exist is worse than no redirect at all.
    const slugRedirect =
      renamedFrom && renamedTo
        ? await redirectRename(existingPost.tenantId, renamedFrom, renamedTo)
        : null;

    return NextResponse.json(
      slugRedirect ? { ...updatedPost, slugRedirect } : updatedPost,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return apiError(error, { route: "PATCH /api/tenant-admin/posts/[id]" });
  }
});

export const DELETE = withAuth(async (_req, { user }, { id: rawId }) => {
  try {
    const email = user.email;
    const role = user.role;

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return apiError(new Error("Unauthorized"), { route: "DELETE /api/tenant-admin/posts/[id]", status: 401, safeMessage: "Unauthorized" });
    }

    const id = parseUuid(rawId);
    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    const existingPost = await prisma.posts.findUnique({ where: { id } });

    if (
      !existingPost ||
      (role !== "SUPER_ADMIN" && existingPost.tenantId !== localUser?.tenantId)
    ) {
      return apiError(new Error("Post not found or unauthorized"), { route: "DELETE /api/tenant-admin/posts/[id]", status: 404, safeMessage: "Post not found or unauthorized" });
    }

    await prisma.posts.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/posts/[id]" });
  }
});
