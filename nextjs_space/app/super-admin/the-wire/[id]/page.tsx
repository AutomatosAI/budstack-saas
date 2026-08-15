import { currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import type { PlatformPostRow } from "@/lib/platform/posts";
import { parseUuid } from "@/lib/validation/parse-uuid";
import PlatformPostForm from "../post-form";

/**
 * Edit one platform post.
 *
 * No tenantId appears in the query and there is no `users` join: the byline is
 * denormalised onto the row, and `platform_posts` is deliberately absent from
 * `tenantScopedModels` (lib/db.ts) — that Set is an opt-in allowlist, and
 * joining it would weld a tenant filter onto this lookup and turn every post
 * into a 404.
 */

/**
 * The build-time Prisma client is a mock answering every query with `[]` /
 * `null` (DATABASE_URL is a dummy at build). Without this the editor would be
 * prerendered as a permanent "not found".
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit post — The Wire",
};

/**
 * The shared UUID matcher, used as a gate rather than as a 400: `parseUuid`
 * throws an ApiError built for a route handler, and an unparseable id in a URL
 * someone typed is a page that does not exist, not a server fault.
 */
function readUuid(raw: string): string | null {
  try {
    return parseUuid(raw);
  } catch {
    return null;
  }
}

export default async function EditPlatformPostPage({
  params,
}: {
  params: { id: string };
}) {
  // The layout gates this segment already; repeated here as the list page and
  // the neighbouring super-admin pages do, so the editor cannot render if it is
  // ever mounted outside that layout.
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const id = readUuid(params.id);
  if (!id) notFound();

  // Row type stated explicitly — the `prisma` export is any-widened, so an
  // inferred result would widen every field read below to `any`.
  const post: PlatformPostRow | null = await prisma.platform_posts.findUnique({
    where: { id },
  });
  if (!post) notFound();

  return (
    <PlatformPostForm
      isEditing
      initialData={{
        id: post.id,
        title: post.title,
        // What the post is published at today. `published` is what freezes it:
        // a live URL cannot move until US-019 writes the 301.
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt ?? "",
        coverImage: post.coverImage ?? "",
        coverImageAlt: post.coverImageAlt ?? "",
        authorName: post.authorName,
        authorRole: post.authorRole ?? "",
        published: post.published,
      }}
    />
  );
}
