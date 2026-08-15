"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { toast } from "@/components/ui/sonner";
import type { PlatformPostFormValues } from "@/lib/platform/post-editor";
import { PLATFORM_POST_IMAGE_ALT_MAX } from "@/lib/platform/posts";

/**
 * The post's cover image and the alt text that describes it.
 *
 * Uploads go to `/api/platform/upload` (US-005), NOT `/api/tenant-admin/upload`:
 * the tenant route reads a tenantId off the session and 403s without one, and a
 * super-admin writing the platform blog has no tenant. The platform route files
 * the bytes under the platform's own S3 prefix, so no tenant delete can ever
 * take a blog cover with it.
 *
 * The alt field appears only once there is an image to describe — an empty
 * "describe the image" box above no image is a question about nothing.
 */
export default function CoverImageField({
  form,
  disabled,
}: {
  form: UseFormReturn<PlatformPostFormValues>;
  disabled: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const coverImage = form.watch("coverImage");

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/platform/upload", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      // The DURABLE url, with the presigned one only as a fallback: `url` stops
      // resolving about an hour after it is issued, which is fine for a preview
      // and useless as the cover of a published article. `publicUrl` is null for
      // anything the public image route would not serve, and that is precisely
      // when it must not be stored.
      const stored: string = json?.publicUrl || json?.url || "";
      if (!stored) throw new Error("Upload returned no URL");

      form.setValue("coverImage", stored, { shouldValidate: true, shouldDirty: true });
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <div className="space-y-2">
        <label htmlFor="coverImage" className="bs-eyebrow">
          Cover Image
        </label>

        {coverImage && (
          <div className="relative aspect-video w-full max-w-sm rounded-bs-md overflow-hidden border border-bs-border-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              // The alt being authored, so the preview reads the way the
              // published article will.
              alt={
                form.watch("coverImageAlt") ||
                form.watch("title") ||
                "Cover preview"
              }
              className="object-cover w-full h-full"
            />
            <button
              type="button"
              onClick={() => form.setValue("coverImage", "", { shouldDirty: true })}
              aria-label="Remove cover image"
              className="bs-btn bs-btn-danger bs-btn-sm absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="coverImage"
            {...form.register("coverImage")}
            placeholder="https://... or upload an image"
            className="bs-input flex-1"
          />
          <div className="relative">
            <button
              type="button"
              disabled={isUploading || disabled}
              aria-label="Upload image"
              className="bs-btn bs-btn-ghost bs-btn-sm h-10 w-10 p-0 flex items-center justify-center disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={isUploading || disabled}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {form.formState.errors.coverImage ? (
          <p className="text-sm text-bs-danger">
            {form.formState.errors.coverImage.message}
          </p>
        ) : (
          <p className="text-xs text-bs-fg-muted">
            Paste a URL or click the upload icon to select a file.
          </p>
        )}
      </div>

      {coverImage && (
        <div className="space-y-2">
          <label htmlFor="coverImageAlt" className="bs-eyebrow">
            Cover Image Alt Text
          </label>
          <input
            id="coverImageAlt"
            {...form.register("coverImageAlt")}
            placeholder="Describe the image for screen readers and image search"
            maxLength={PLATFORM_POST_IMAGE_ALT_MAX}
            className="bs-input w-full"
          />
          <p className="text-xs text-bs-fg-muted">
            Leave empty to fall back to the post title.
          </p>
        </div>
      )}
    </>
  );
}
