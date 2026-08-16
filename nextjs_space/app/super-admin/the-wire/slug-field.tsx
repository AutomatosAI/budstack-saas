"use client";

import { ArrowRightLeft } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { PlatformPostFormValues } from "@/lib/platform/post-editor";
import { PUBLISHED_SLUG_MOVE_NOTE } from "@/lib/platform/posts";
import { BLOG_INDEX_PATH, blogPostPath } from "@/lib/seo/blog-paths";
import { POST_SLUG_HINT, POST_SLUG_MAX_LENGTH } from "@/lib/seo/post-slug";

/**
 * The post's URL, and the one field where a save has a consequence beyond this
 * post.
 *
 * It used to go READ-ONLY once the post was published, because renaming a live
 * article 404s a URL that is already indexed and already linked to. US-019
 * removed that lock by removing the reason for it: the save now writes a 301
 * from the old path (lib/seo/platform-slug-redirects.ts), so every existing
 * link keeps resolving.
 *
 * What is left is a WARNING, not a refusal, and it appears only when the field
 * has actually been changed on a live post — a warning shown next to an
 * untouched URL is noise the author learns to skip past. The one refusal still
 * possible is a slug another post already owns, which the API answers with 409.
 */
export default function SlugField({
  form,
  isMove,
  onEdited,
}: {
  form: UseFormReturn<PlatformPostFormValues>;
  /** Live post + changed URL: this save moves a public address. */
  isMove: boolean;
  /** Told the author typed here, so the title stops driving the slug. */
  onEdited: () => void;
}) {
  const slug = form.watch("slug");
  const error = form.formState.errors.slug?.message;
  const noteId = "slug-hint";

  return (
    <div className="space-y-2">
      <label htmlFor="slug" className="bs-eyebrow">
        Post URL
      </label>

      <div className="flex items-center gap-2">
        <span className="text-sm text-bs-fg-muted shrink-0">
          {BLOG_INDEX_PATH}/
        </span>
        <input
          id="slug"
          {...form.register("slug", { onChange: onEdited })}
          maxLength={POST_SLUG_MAX_LENGTH}
          spellCheck={false}
          placeholder="derived-from-the-title"
          aria-describedby={noteId}
          className="bs-input flex-1"
        />
      </div>

      {error ? (
        <p id={noteId} className="text-sm text-bs-danger">
          {error}
        </p>
      ) : (
        <p id={noteId} className="text-xs text-bs-fg-muted">
          {POST_SLUG_HINT} Published at{" "}
          <code>{blogPostPath(slug || "…")}</code>.
        </p>
      )}

      {/* The same sentence lib/platform/posts.ts holds, so the editor and any
          other surface describing this rule cannot word it differently. */}
      {isMove ? (
        <p className="flex items-start gap-2 text-xs text-bs-fg-muted">
          <ArrowRightLeft
            className="h-3.5 w-3.5 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{PUBLISHED_SLUG_MOVE_NOTE}</span>
        </p>
      ) : null}
    </div>
  );
}
