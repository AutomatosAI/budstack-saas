"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/sonner";

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
        <div className="border rounded-md overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Author</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {posts.map((post) => (
                        <TableRow key={post.id}>
                            <TableCell className="font-medium">
                                <div className="min-w-0">
                                    <span className="block truncate max-w-[150px] sm:max-w-[250px]">{post.title}</span>
                                    <div className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[200px]">
                                        /{post.slug}
                                    </div>
                                    {/* Show author/date on mobile */}
                                    <div className="sm:hidden text-xs text-muted-foreground mt-1">
                                        {post.users?.name || 'Unknown'} • {format(new Date(post.createdAt), 'MMM d')}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={post.published ? 'default' : 'secondary'}>
                                    {post.published ? 'Published' : 'Draft'}
                                </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{post.users?.name || 'Unknown'}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                                {format(new Date(post.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Link href={`/tenant-admin/the-wire/${post.id}`} passHref>
                                        <Button variant="ghost" size="icon" title="Edit article">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleTogglePublish(post.id, post.published)}
                                        title={post.published ? 'Unpublish article' : 'Publish article'}
                                        className={post.published ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
                                    >
                                        {post.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(post.id)}
                                        disabled={isDeleting === post.id}
                                        className="text-destructive hover:text-destructive/90"
                                        title="Delete article"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Author</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <TableRow key={post.id}>
              <TableCell className="font-medium">
                <div className="min-w-0">
                  <span className="block truncate max-w-[150px] sm:max-w-[250px]">
                    {post.title}
                  </span>
                  <div className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[200px]">
                    /{post.slug}
                  </div>
                  {/* Show author/date on mobile */}
                  <div className="sm:hidden text-xs text-muted-foreground mt-1">
                    {post.author?.name || "Unknown"} •{" "}
                    {format(new Date(post.createdAt), "MMM d")}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={post.published ? "default" : "secondary"}>
                  {post.published ? "Published" : "Draft"}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {post.author?.name || "Unknown"}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {format(new Date(post.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/tenant-admin/the-wire/${post.id}`} passHref>
                    <Button variant="ghost" size="icon" title="Edit article">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTogglePublish(post.id, post.published)}
                    title={
                      post.published ? "Unpublish article" : "Publish article"
                    }
                    className={
                      post.published
                        ? "text-amber-600 hover:text-amber-700"
                        : "text-green-600 hover:text-green-700"
                    }
                  >
                    {post.published ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(post.id)}
                    disabled={isDeleting === post.id}
                    className="text-destructive hover:text-destructive/90"
                    title="Delete article"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
