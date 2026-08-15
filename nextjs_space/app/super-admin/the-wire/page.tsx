import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import {
  PLATFORM_POST_SUMMARY_SELECT,
  type PlatformPostSummary,
} from "@/lib/platform/posts";
import PlatformPostsList from "./posts-list";

/**
 * The Wire — the budstacks.io blog, written by the platform team.
 *
 * This is NOT the tenant Wire (`app/tenant-admin/the-wire`). `platform_posts`
 * has no tenant and a denormalised byline, so no query here names a tenantId
 * and there is no `users` join to get wrong. The model is deliberately absent
 * from `tenantScopedModels` (lib/db.ts) — that Set is an opt-in allowlist, and
 * joining it would weld a tenant filter onto this query and empty the list.
 */

/**
 * The build-time Prisma client is a mock that answers every query with `[]`
 * (DATABASE_URL is a dummy at build). Without this the empty state would be
 * baked into the static output and every super-admin would see "no posts".
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Wire — Platform",
};

export default async function PlatformWirePage() {
  // The layout gates this segment already; repeated here as the neighbouring
  // super-admin pages do (leads, subprocessors), so the page cannot render its
  // content if it is ever mounted outside that layout.
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Row type stated explicitly: the `prisma` export is any-widened, so an
  // inferred result makes every map callback in the list an implicit `any`
  // (TS7006). The summary select drops `content` — the article body is the one
  // big column and the list never shows it.
  const posts: PlatformPostSummary[] = await prisma.platform_posts.findMany({
    orderBy: { createdAt: "desc" },
    select: PLATFORM_POST_SUMMARY_SELECT,
  });

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="bs-page-title"
            style={{
              fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
            }}
          >
            The Wire
          </h1>
          <p className="bs-page-subtitle">
            The budstacks.io blog. Publishing here puts an article live at
            /blog — no pull request, no deploy.
          </p>
        </div>
        <Link href="/super-admin/the-wire/new" className="bs-btn bs-btn-green">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New post
        </Link>
      </div>

      <PlatformPostsList initialPosts={posts} />
    </div>
  );
}
