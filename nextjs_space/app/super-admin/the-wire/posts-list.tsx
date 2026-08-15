"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Edit, Eye, EyeOff, Newspaper, Trash2 } from "lucide-react";

import { RowPill } from "@/components/admin/shared/RowPill";
import { toast } from "@/components/ui/sonner";
import type { PlatformPostSummary } from "@/lib/platform/posts";
import { blogPostPath } from "@/lib/seo/blog-paths";

/**
 * The platform post list, adapted from `app/tenant-admin/the-wire/posts-list.tsx`
 * and pointed at `/api/platform/posts/[id]`.
 *
 * What the tenant version has and this one does not:
 *  - the newsletter action (campaigns are a tenant feature),
 *  - the `source === "AUTOMATOS"` pill (platform posts are hand-written),
 *  - the `users` join for the byline — `platform_posts` denormalises the author
 *    into `authorName` / `authorRole`, so there is no relation to read.
 *
 * Both destructive-ish actions confirm first: publishing puts a URL on the
 * public internet, and unpublishing or deleting takes a live one away.
 */

/** The API answers with ISO strings; the server component sends real Dates. */
type DateLike = Date | string | null;

function formatDate(value: DateLike): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "d MMM yyyy");
}

/** The two fields a publish toggle changes, as the PATCH route answers them. */
interface PatchedPost {
  published?: boolean;
  publishedAt?: string | null;
}

export default function PlatformPostsList({
  initialPosts,
}: {
  initialPosts: PlatformPostSummary[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<PlatformPostSummary[]>(initialPosts);
  // One busy row at a time, whichever action is running: a second click while
  // a delete is in flight would answer 404 and read as a failure.
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleTogglePublish = useCallback(
    async (post: PlatformPostSummary) => {
      const next = !post.published;
      const ok = window.confirm(
        next
          ? `Publish "${post.title}"?\n\nIt goes live at ${blogPostPath(post.slug)}.`
          : `Unpublish "${post.title}"?\n\nIts live URL ${blogPostPath(post.slug)} stops resolving, and anything already linking to it breaks.`,
      );
      if (!ok) return;

      setBusyId(post.id);
      try {
        const res = await fetch(`/api/platform/posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: next }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Something went wrong.");

        // Taken from the response rather than assumed: `publishedAt` is stamped
        // server-side on the first publish and deliberately kept on unpublish,
        // so the row reflects what was actually written.
        const patched: PatchedPost = json?.post ?? {};
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  published: patched.published ?? next,
                  publishedAt: patched.publishedAt
                    ? new Date(patched.publishedAt)
                    : null,
                }
              : p,
          ),
        );
        toast.success(next ? "Post published" : "Post unpublished");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update the post.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const handleDelete = useCallback(
    async (post: PlatformPostSummary) => {
      const ok = window.confirm(
        `Delete "${post.title}"?\n\nThis cannot be undone.` +
          (post.published
            ? ` It is live at ${blogPostPath(post.slug)} — that URL will 404.`
            : ""),
      );
      if (!ok) return;

      setBusyId(post.id);
      try {
        const res = await fetch(`/api/platform/posts/${post.id}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Something went wrong.");

        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        toast.success("Post deleted");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete the post.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  if (posts.length === 0) {
    return (
      <section className="bs-card bs-card-pad">
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-bs-md bs-card-2 border border-bs-border-100 mb-4">
            <Newspaper className="h-8 w-8 text-bs-fg-muted" aria-hidden="true" />
          </div>
          <h3
            className="text-[22px] font-semibold text-bs-fg mb-2"
            style={{
              fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
            }}
          >
            No posts yet
          </h3>
          <p className="text-bs-fg-muted">
            Write the first one — it publishes straight to budstacks.io/blog.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bs-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="bs-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th className="hidden sm:table-cell">Author</th>
              <th className="hidden sm:table-cell">Published</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-bs-card-2">
                <td className="font-medium text-bs-fg">
                  <div className="min-w-0">
                    <span className="block truncate max-w-[150px] sm:max-w-[250px]">
                      {post.title}
                    </span>
                    <div className="text-xs text-bs-fg-muted truncate max-w-[150px] sm:max-w-[200px] font-mono">
                      {blogPostPath(post.slug)}
                    </div>
                    <div className="sm:hidden text-xs text-bs-fg-muted mt-1">
                      {post.authorName} •{" "}
                      <span className="font-mono">
                        {formatDate(post.publishedAt)}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <RowPill tone={post.published ? "emerald" : "slate"}>
                    {post.published ? "Published" : "Draft"}
                  </RowPill>
                </td>
                <td className="hidden sm:table-cell text-bs-fg-muted">
                  {post.authorName}
                  {post.authorRole ? (
                    <span className="block text-xs">{post.authorRole}</span>
                  ) : null}
                </td>
                <td className="hidden sm:table-cell font-mono text-bs-fg-muted">
                  {formatDate(post.publishedAt)}
                </td>
                <td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 min-w-[120px]">
                    <Link
                      href={`/super-admin/the-wire/${post.id}`}
                      title="Edit post"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(post)}
                      disabled={busyId === post.id}
                      title={post.published ? "Unpublish post" : "Publish post"}
                      className={
                        post.published
                          ? "bs-btn bs-btn-ghost bs-btn-sm text-bs-warn disabled:opacity-50"
                          : "bs-btn bs-btn-ghost bs-btn-sm text-bs-green-soft disabled:opacity-50"
                      }
                    >
                      {post.published ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(post)}
                      disabled={busyId === post.id}
                      title="Delete post"
                      className="bs-btn bs-btn-ghost bs-btn-sm text-bs-danger disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
