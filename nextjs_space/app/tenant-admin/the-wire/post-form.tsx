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
import { Upload, X, Loader2, AlertTriangle } from "lucide-react";
import { UPGRADE_CTA_LABEL, UPGRADE_PATH } from "@/lib/entitlements/upgrade";
import {
  POST_SLUG_HINT,
  POST_SLUG_MAX_LENGTH,
  POST_SLUG_PATTERN,
} from "@/lib/seo/post-slug";
import { WIRE_INDEX_PATH, wirePostPath } from "@/lib/seo/wire-paths";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  // US-009 — alt text for the cover, authored next to the image it describes.
  // Persisted to `posts.seo.imageAlt` by the write routes (posts has no column
  // for it and needs none); the SEO Manager edits the same key.
  coverImageAlt: z.string().max(300).optional(),
  // US-021 — the article's URL. Validated against the shared pattern rather
  // than silently rewritten, because a URL box that edits what you typed is how
  // a link ends up somewhere nobody chose. The server canonicalises with the
  // same rule for callers who are not looking at this form.
  slug: z
    .string()
    .max(POST_SLUG_MAX_LENGTH)
    .regex(POST_SLUG_PATTERN, POST_SLUG_HINT)
    .optional(),
  published: z.boolean().default(false),
});

type PostFormData = z.infer<typeof postSchema>;

interface PostFormProps {
  initialData?: PostFormData & { id?: string };
  isEditing?: boolean;
  /**
   * US-021 — does this tenant's plan include `seo.pro`? PRESENTATION ONLY: it
   * decides which sentence the slug warning shows. Whether a 301 is actually
   * written is decided server-side in the PATCH route, from the plan column.
   */
  seoProUnlocked?: boolean;
}

export default function PostForm({
  initialData,
  isEditing = false,
  seoProUnlocked = false,
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
      // Prefer the durable URL (US-005) — data.url is a presigned link that
      // stops resolving about an hour after the post is written. Older uploads
      // and non-image files have no durable form, hence the fallback.
      form.setValue("coverImage", data.publicUrl || data.url);
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
      coverImageAlt: "",
      // Absent on create: the slug is derived from the title by the POST route,
      // and a brand-new article has no URL worth defending. It becomes editable
      // the moment there is something to redirect FROM.
      published: false,
    },
  });

  // US-021 — the URL is about to change, so say what that costs BEFORE the
  // save. `initialData.slug` is what the post is published at right now.
  const currentSlug = form.watch("slug");
  const slugChanged = Boolean(
    isEditing &&
      initialData?.slug &&
      currentSlug &&
      currentSlug !== initialData.slug,
  );

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

      // US-021 — the server reports what the rename actually did to the old
      // URL. It is the only thing that knows: the plan is read from the column,
      // and the slug can still shift under the uniqueness loop.
      const saved: unknown = await res.json().catch(() => null);
      const outcome = (
        saved as {
          slug?: unknown;
          slugRedirect?: { redirected?: unknown; reason?: unknown };
        } | null
      )?.slugRedirect;

      if (outcome?.redirected) {
        toast.success("Article updated", {
          description: "The old URL now redirects here.",
        });
      } else if (outcome?.reason === "not_entitled") {
        toast.warning("Article updated — the old URL now 404s", {
          description: "Pro redirects a renamed article's old URL for you.",
        });
      } else if (outcome) {
        toast.warning("Article updated — the old URL was not redirected", {
          description: "Add the redirect by hand in SEO Manager → Redirects.",
        });
      } else {
        toast.success(isEditing ? "Article updated" : "Article created");
      }

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

              {/* US-021 — editable only once the article HAS a URL. On create
                  the slug comes from the title and there is nothing to move. */}
              {isEditing && initialData?.slug && (
                <div className="space-y-2">
                  <label htmlFor="slug" className="bs-eyebrow">
                    Article URL
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-bs-fg-muted shrink-0">
                      {WIRE_INDEX_PATH}/
                    </span>
                    <input
                      id="slug"
                      {...form.register("slug")}
                      maxLength={POST_SLUG_MAX_LENGTH}
                      spellCheck={false}
                      className="bs-input flex-1"
                    />
                  </div>
                  {form.formState.errors.slug ? (
                    <p className="text-sm text-bs-danger">
                      {form.formState.errors.slug.message}
                    </p>
                  ) : (
                    <p className="text-xs text-bs-fg-muted">{POST_SLUG_HINT}</p>
                  )}

                  {slugChanged && (
                    <div className="flex gap-3 rounded-bs-md border border-bs-warn/[0.32] bg-bs-warn/[0.08] p-3">
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 mt-0.5 text-bs-warn"
                        aria-hidden="true"
                      />
                      <div className="space-y-1 text-xs">
                        <p className="text-bs-fg">
                          This article moves to{" "}
                          <code>{wirePostPath(currentSlug ?? "")}</code>.
                        </p>
                        {seoProUnlocked ? (
                          <p className="text-bs-fg-muted">
                            Saving points{" "}
                            <code>{wirePostPath(initialData.slug)}</code> at the
                            new URL with a 301, so existing links and search
                            rankings follow it.
                          </p>
                        ) : (
                          <>
                            <p className="text-bs-fg-muted">
                              <code>{wirePostPath(initialData.slug)}</code> will
                              stop working — anyone following an existing link,
                              and every search result pointing at it, gets a 404.
                            </p>
                            <Link
                              href={UPGRADE_PATH}
                              className="inline-block underline text-bs-fg"
                            >
                              {UPGRADE_CTA_LABEL}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                        alt={
                          // The alt being authored, so the preview reads the way
                          // the published article will. "Cover preview" was a
                          // description of the widget, not of the picture.
                          form.watch("coverImageAlt") ||
                          form.watch("title") ||
                          "Cover preview"
                        }
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

              {/* US-009 — alt text, shown only once there is an image to describe. */}
              {form.watch("coverImage") && (
                <div className="space-y-2">
                  <label htmlFor="coverImageAlt" className="bs-eyebrow">
                    Cover Image Alt Text
                  </label>
                  <input
                    id="coverImageAlt"
                    {...form.register("coverImageAlt")}
                    placeholder="Describe the image for screen readers and image search"
                    maxLength={300}
                    className="bs-input w-full"
                  />
                  <p className="text-xs text-bs-fg-muted">
                    Leave empty to fall back to the article title.
                  </p>
                </div>
              )}
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
