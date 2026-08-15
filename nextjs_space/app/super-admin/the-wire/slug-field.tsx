"use client";

import { Lock } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { PlatformPostFormValues } from "@/lib/platform/post-editor";
import { PUBLISHED_SLUG_LOCKED_MESSAGE } from "@/lib/platform/posts";
import { BLOG_INDEX_PATH, blogPostPath } from "@/lib/seo/blog-paths";
import { POST_SLUG_HINT, POST_SLUG_MAX_LENGTH } from "@/lib/seo/post-slug";

/**
 * The post's URL, and the one control in this editor that can be taken away.
 *
 * While the post is a DRAFT the field is free: nothing links to it yet, so
 * renaming costs nothing. Once it is PUBLISHED the field goes read-only, and
 * the reason is stated next to it rather than left to be discovered by a 409 —
 * a live URL that starts 404ing takes its inbound links and its search
 * placement with it, and the automatic 301 that would make a rename safe is
 * US-019.
 *
 * Read-only rather than `disabled`: the value stays visible and selectable (an
 * author usually wants to copy the live URL, not edit it), it remains
 * focusable so a screen reader reaches the explanation this field points at,
 * and react-hook-form keeps holding it — a `disabled` registered input would
 * drop out of the submitted values.
 */
export default function SlugField({
  form,
  locked,
  onEdited,
}: {
  form: UseFormReturn<PlatformPostFormValues>;
  locked: boolean;
  /** Told the author typed here, so the title stops driving the slug. */
  onEdited: () => void;
}) {
  const slug = form.watch("slug");
  const error = form.formState.errors.slug?.message;
  const noteId = locked ? "slug-locked-note" : "slug-hint";

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
          readOnly={locked}
          maxLength={POST_SLUG_MAX_LENGTH}
          spellCheck={false}
          placeholder="derived-from-the-title"
          aria-describedby={noteId}
          className={
            locked
              ? "bs-input flex-1 opacity-60 cursor-not-allowed"
              : "bs-input flex-1"
          }
        />
        {locked && (
          <Lock
            className="h-4 w-4 shrink-0 text-bs-fg-muted"
            aria-hidden="true"
          />
        )}
      </div>

      {locked ? (
        // The same sentence the PATCH route answers a rename with, so the
        // editor and the API cannot describe the rule differently.
        <p id={noteId} className="text-xs text-bs-fg-muted">
          {PUBLISHED_SLUG_LOCKED_MESSAGE}
        </p>
      ) : error ? (
        <p id={noteId} className="text-sm text-bs-danger">
          {error}
        </p>
      ) : (
        <p id={noteId} className="text-xs text-bs-fg-muted">
          {POST_SLUG_HINT} Published at{" "}
          <code>{blogPostPath(slug || "…")}</code>.
        </p>
      )}
    </div>
  );
}
