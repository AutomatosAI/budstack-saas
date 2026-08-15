"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import Tiptap from "@/components/editor/tiptap";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  DEFAULT_PLATFORM_AUTHOR_NAME,
  DEFAULT_PLATFORM_AUTHOR_ROLE,
  buildPlatformPostBody,
  deriveDraftSlug,
  isPublishedSlugLocked,
  type PlatformPostFormValues,
} from "@/lib/platform/post-editor";
import {
  PLATFORM_POST_AUTHOR_NAME_MAX,
  PLATFORM_POST_AUTHOR_ROLE_MAX,
  PLATFORM_POST_CONTENT_MAX,
  PLATFORM_POST_EXCERPT_MAX,
  PLATFORM_POST_IMAGE_ALT_MAX,
  PLATFORM_POST_IMAGE_MAX,
  PLATFORM_POST_TITLE_MAX,
} from "@/lib/platform/posts";
import { POST_SLUG_HINT, POST_SLUG_MAX_LENGTH, POST_SLUG_PATTERN } from "@/lib/seo/post-slug";
import CoverImageField from "./cover-image-field";
import SlugField from "./slug-field";

/**
 * Write and edit a budstacks.io blog post (US-007). Publishing here puts an
 * article live at /blog with no pull request and no deploy.
 *
 * Adapted from `app/tenant-admin/the-wire/post-form.tsx`, with the two pieces
 * that belong to a TENANT deliberately removed:
 *
 *  - the SEO-Pro entitlement gating around the slug warning. Entitlements are a
 *    plan a tenant is on; the platform is not a customer of itself, and a
 *    feature flag read from a tenant's plan column has nothing to answer here.
 *  - the `AiAssistButton` on the alt-text field, which calls a route that
 *    resolves Automatos credentials per tenant — there is no tenant to resolve
 *    them from, so the button could only ever fail.
 *
 * Also gone: the tenant form's `slugRedirect` result handling, because there is
 * nothing to report yet. A published post's URL is frozen until US-019 writes
 * the 301 (see `slug-field.tsx`), so no save here can move a live URL.
 *
 * The API is the boundary that matters: every rule the form applies is applied
 * again by `/api/platform/posts`, which is super-admin-only, same-origin-only
 * and sanitises the body on the way in.
 */

/**
 * The client-side contract, built from the SAME constants the server schema
 * uses (`lib/platform/posts.ts`) so a value this form accepts is a value the
 * route accepts. Stated separately rather than imported because the two answer
 * different questions: the server describes a partial patch where an absent key
 * means "leave it alone", while the form always has every field and needs a
 * concrete value type for `useForm`.
 */
const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(PLATFORM_POST_TITLE_MAX),
  // Empty is legal: on create the POST route derives the slug from the title.
  // Anything non-empty must be a URL segment — validated, never silently
  // rewritten, because a URL box that edits what you typed publishes an article
  // somewhere nobody chose.
  slug: z
    .string()
    .trim()
    .max(POST_SLUG_MAX_LENGTH, POST_SLUG_HINT)
    .refine((value) => value === "" || POST_SLUG_PATTERN.test(value), POST_SLUG_HINT),
  content: z
    .string()
    .min(1, "Content is required")
    .max(PLATFORM_POST_CONTENT_MAX),
  excerpt: z.string().trim().max(PLATFORM_POST_EXCERPT_MAX),
  coverImage: z.string().trim().max(PLATFORM_POST_IMAGE_MAX),
  coverImageAlt: z.string().trim().max(PLATFORM_POST_IMAGE_ALT_MAX),
  authorName: z
    .string()
    .trim()
    .min(1, "Author name is required")
    .max(PLATFORM_POST_AUTHOR_NAME_MAX),
  authorRole: z.string().trim().max(PLATFORM_POST_AUTHOR_ROLE_MAX),
  published: z.boolean(),
});

const WIRE_INDEX = "/super-admin/the-wire";

const BLANK: PlatformPostFormValues = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  coverImage: "",
  coverImageAlt: "",
  authorName: DEFAULT_PLATFORM_AUTHOR_NAME,
  authorRole: DEFAULT_PLATFORM_AUTHOR_ROLE,
  published: false,
};

export default function PlatformPostForm({
  initialData,
  isEditing = false,
}: {
  initialData?: PlatformPostFormValues & { id: string };
  isEditing?: boolean;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  // Once the author types in the URL field, the title stops driving it. An
  // existing post counts as touched: its slug was chosen, not derived.
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData?.slug));

  const form = useForm<PlatformPostFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ?? BLANK,
  });

  // Keyed off the SAVED publish state, not the toggle below: the PATCH route
  // compares against the row in the database, so unpublishing and renaming in
  // one save is refused. The URL unlocks after the unpublish is saved.
  const slugLocked = isPublishedSlugLocked({
    isEditing,
    savedPublished: Boolean(initialData?.published),
  });

  const onSubmit = async (values: PlatformPostFormValues) => {
    setIsSaving(true);
    try {
      const res = await fetch(
        isEditing && initialData
          ? `/api/platform/posts/${initialData.id}`
          : "/api/platform/posts",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPlatformPostBody(values, { slugLocked })),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Something went wrong.");

      toast.success(
        isEditing
          ? "Post updated"
          : values.published
            ? "Post published"
            : "Draft saved",
      );
      router.push(WIRE_INDEX);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the post.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{
            fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
          }}
        >
          {isEditing ? "Edit post" : "New post"}
        </h1>
        <p className="bs-page-subtitle">
          {isEditing
            ? "Update the post and its settings."
            : "Write a post for the budstacks.io blog."}
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="bs-card bs-card-pad space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="bs-eyebrow">
                Title
              </label>
              <input
                id="title"
                {...form.register("title", {
                  // The URL follows the headline until someone edits it
                  // directly, and only on create — an existing post's URL is
                  // never rewritten by a title change it did not ask for.
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (isEditing || slugTouched) return;
                    form.setValue("slug", deriveDraftSlug(event.target.value), {
                      shouldValidate: true,
                    });
                  },
                })}
                placeholder="Post title"
                maxLength={PLATFORM_POST_TITLE_MAX}
                className="bs-input w-full"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-bs-danger">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <SlugField
              form={form}
              locked={slugLocked}
              onEdited={() => setSlugTouched(true)}
            />

            <div className="space-y-2">
              <label htmlFor="excerpt" className="bs-eyebrow">
                Excerpt
              </label>
              <textarea
                id="excerpt"
                {...form.register("excerpt")}
                placeholder="Short summary for the index and for search results..."
                className="bs-input w-full h-20"
              />
              {form.formState.errors.excerpt && (
                <p className="text-sm text-bs-danger">
                  {form.formState.errors.excerpt.message}
                </p>
              )}
            </div>

            <CoverImageField form={form} disabled={isSaving} />
          </section>

          {/* The byline is denormalised text on `platform_posts`, not a users
              relation — there is no tenant-scoped user to join to, and it lets
              the platform publish as itself rather than as whoever was logged
              in. Defaults to the byline the existing posts already carry. */}
          <section className="bs-card bs-card-pad grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="authorName" className="bs-eyebrow">
                Author
              </label>
              <input
                id="authorName"
                {...form.register("authorName")}
                maxLength={PLATFORM_POST_AUTHOR_NAME_MAX}
                className="bs-input w-full"
              />
              {form.formState.errors.authorName && (
                <p className="text-sm text-bs-danger">
                  {form.formState.errors.authorName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="authorRole" className="bs-eyebrow">
                Author Role
              </label>
              <input
                id="authorRole"
                {...form.register("authorRole")}
                placeholder="Platform Team"
                maxLength={PLATFORM_POST_AUTHOR_ROLE_MAX}
                className="bs-input w-full"
              />
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
                  ? "Live on budstacks.io/blog"
                  : "Saved as a draft — not visible to anyone else"}
              </p>
            </div>
            <Switch
              checked={form.watch("published")}
              onCheckedChange={(checked) =>
                form.setValue("published", checked, { shouldDirty: true })
              }
            />
          </section>

          <div className="flex justify-end gap-4 pt-4">
            <Link href={WIRE_INDEX} className="bs-btn bs-btn-ghost">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="bs-btn bs-btn-green disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : isEditing ? (
                "Update post"
              ) : (
                "Create post"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
