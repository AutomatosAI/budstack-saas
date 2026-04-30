"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Eye, EyeOff, Newspaper } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { RowPill } from "@/components/admin/shared/RowPill";

interface Post {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  createdAt: Date;
  users?: { name: string | null } | null;
}

export default function PostsList({ initialPosts }: { initialPosts: any[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/tenant-admin/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !currentStatus }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setPosts(
        posts.map((p) =>
          p.id === id ? { ...p, published: !currentStatus } : p,
        ),
      );
      toast.success(
        currentStatus ? "Article unpublished" : "Article published",
      );
      router.refresh();
    } catch (error) {
      toast.error("Failed to update article");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    setIsDeleting(id);
    try {
      const res = await fetch(`/api/tenant-admin/posts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setPosts(posts.filter((p) => p.id !== id));
      toast.success("Article deleted");
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete article");
    } finally {
      setIsDeleting(null);
    }
  };

  if (posts.length === 0) {
    return (
      <section className="bs-card bs-card-pad">
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-bs-md bs-card-2 border border-bs-border-100 mb-4">
            <Newspaper className="h-8 w-8 text-bs-fg-muted" aria-hidden="true" />
          </div>
          <h3
            className="text-[22px] font-semibold text-bs-fg mb-2"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            No articles yet
          </h3>
          <p className="text-bs-fg-muted">
            Create your first article to get started.
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
              <th className="hidden sm:table-cell">Date</th>
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
                      /{post.slug}
                    </div>
                    <div className="sm:hidden text-xs text-bs-fg-muted mt-1">
                      {post.users?.name || "Unknown"} •{" "}
                      <span className="font-mono">
                        {format(new Date(post.createdAt), "MMM d")}
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
                  {post.users?.name || "Unknown"}
                </td>
                <td className="hidden sm:table-cell font-mono text-bs-fg-muted">
                  {format(new Date(post.createdAt), "MMM d, yyyy")}
                </td>
                <td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 min-w-[120px]">
                    <Link
                      href={`/tenant-admin/the-wire/${post.id}`}
                      title="Edit article"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(post.id, post.published)}
                      title={
                        post.published ? "Unpublish article" : "Publish article"
                      }
                      className={
                        post.published
                          ? "bs-btn bs-btn-ghost bs-btn-sm text-bs-warn"
                          : "bs-btn bs-btn-ghost bs-btn-sm text-bs-green-soft"
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
                      onClick={() => handleDelete(post.id)}
                      disabled={isDeleting === post.id}
                      title="Delete article"
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
