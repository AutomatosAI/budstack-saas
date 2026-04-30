"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Switch } from "@/components/ui/switch";
import Tiptap from "@/components/editor/tiptap";
import { toast } from "@/components/ui/sonner";
import Link from "next/link";
import { Upload, X, Loader2 } from "lucide-react";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  published: z.boolean().default(false),
});

type PostFormData = z.infer<typeof postSchema>;

interface PostFormProps {
  initialData?: PostFormData & { id?: string };
  isEditing?: boolean;
}

export default function PostForm({
  initialData,
  isEditing = false,
}: PostFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/tenant-admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      form.setValue("coverImage", data.url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const form = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: initialData || {
      title: "",
      content: "",
      excerpt: "",
      coverImage: "",
      published: false,
    },
  });

  const onSubmit = async (data: PostFormData) => {
    setIsLoading(true);
    try {
      const url =
        isEditing && initialData?.id
          ? `/api/tenant-admin/posts/${initialData.id}`
          : "/api/tenant-admin/posts";

      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Something went wrong");
      }

      toast.success(isEditing ? "Article updated" : "Article created");
      router.push("/tenant-admin/the-wire");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          {isEditing ? "Edit Article" : "New Article"}
        </h1>
        <p className="bs-page-subtitle">
          {isEditing
            ? "Update your article content and settings"
            : "Create a new article for The Wire"}
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6">
            <section className="bs-card bs-card-pad space-y-4">
              <div className="space-y-2">
                <label htmlFor="title" className="bs-eyebrow">
                  Title
                </label>
                <input
                  id="title"
                  {...form.register("title")}
                  placeholder="Article Title"
                  className="bs-input w-full"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-bs-danger">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="excerpt" className="bs-eyebrow">
                  Excerpt
                </label>
                <textarea
                  id="excerpt"
                  {...form.register("excerpt")}
                  placeholder="Short summary for preview cards..."
                  className="bs-input w-full h-20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="coverImage" className="bs-eyebrow">
                  Cover Image
                </label>
                <div className="flex flex-col gap-4">
                  {form.watch("coverImage") && (
                    <div className="relative aspect-video w-full max-w-sm rounded-bs-md overflow-hidden border border-bs-border-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.watch("coverImage")}
                        alt="Cover preview"
                        className="object-cover w-full h-full"
                      />
                      <button
                        type="button"
                        className="bs-btn bs-btn-danger bs-btn-sm absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center"
                        onClick={() => form.setValue("coverImage", "")}
                        aria-label="Remove cover image"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      id="coverImage"
                      {...form.register("coverImage")}
                      placeholder="https://... or upload image"
                      className="bs-input flex-1"
                    />
                    <div className="relative">
                      <button
                        type="button"
                        disabled={isUploading}
                        className="bs-btn bs-btn-ghost bs-btn-sm h-10 w-10 p-0 flex items-center justify-center disabled:opacity-50"
                        aria-label="Upload image"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Upload className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-bs-fg-muted">
                    Paste a URL or click the upload icon to select a file.
                  </p>
                </div>
              </div>
            </section>

            <section className="bs-card bs-card-pad">
              <div className="space-y-2">
                <label className="bs-eyebrow">Content</label>
                <Tiptap
                  content={form.getValues("content")}
                  onChange={(html) =>
                    form.setValue("content", html, { shouldValidate: true })
                  }
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-bs-danger">
                    {form.formState.errors.content.message}
                  </p>
                )}
              </div>
            </section>

            <section className="bs-card bs-card-pad flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="bs-eyebrow block">Publish Status</span>
                <p className="text-sm text-bs-fg-muted">
                  {form.watch("published")
                    ? "Article is live"
                    : "Article is saved as draft"}
                </p>
              </div>
              <Switch
                checked={form.watch("published")}
                onCheckedChange={(checked) =>
                  form.setValue("published", checked)
                }
              />
            </section>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link href="/tenant-admin/the-wire" className="bs-btn bs-btn-ghost">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="bs-btn bs-btn-green disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Article"
              ) : (
                "Create Article"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
