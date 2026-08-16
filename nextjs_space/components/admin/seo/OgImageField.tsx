"use client";

/**
 * SEO Supercharge US-019 — the Open Graph image row of the SEO editor.
 *
 * WHAT IS PRO HERE, AND WHAT IS NOT. Every tenant keeps the URL field: the
 * `ogImage` key is read by Workstream A on every storefront page, so it is part
 * of Basic and always was. The Pro line is the STUDIO around it — US-018's
 * branded card, and uploading a file without leaving the editor.
 *
 * THE LOCK IS PRESENTATION, AND — UNUSUALLY FOR THIS WORKSTREAM — THERE IS NO
 * SERVER GATE UNDERNEATH IT. Stated plainly rather than implied, because every
 * other Pro capability does have one. `/api/tenant-admin/upload` is the shared
 * endpoint behind blog covers and branding logos, which Basic tenants use every
 * day: plan-gating it would break those, and a parallel Pro-only upload route
 * would gate nothing, since the same tenant can already upload a file in the
 * Wire editor and paste the durable URL into the field beside this button. So
 * the button is a convenience, not a privilege, and hiding it grants a Basic
 * tenant no less access than they had. Every capability that IS a privilege
 * (JSON-LD, redirects, indexing controls, AI assist) is gated by
 * `requireFeature(FEATURES.SEO_PRO, …)` on its own route.
 *
 * WHY UPLOADING BEATS PASTING, beyond convenience: the storefront and the admin
 * both run under `img-src 'self' data: blob: https://*.amazonaws.com`
 * (lib/security/csp.ts), so an image on any other host cannot even be previewed
 * here — and if the owner pasted a presigned S3 link, `storedPublicImagePath`
 * drops it and the page emits no `og:image` at all. An uploaded file comes back
 * as US-005's durable same-origin path, which survives both.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { UPGRADE_CTA_LABEL, UPGRADE_PATH } from "@/lib/entitlements/upgrade";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/seo/og-image";
import {
  OG_IMAGE_ACCEPT,
  OG_IMAGE_MAX_LABEL,
  OG_IMAGE_UPLOAD_URL,
  ogImageFileError,
  ogImageSizeWarning,
  uploadOgImage,
  type ImageSize,
} from "./og-image-upload";

interface OgImageFieldProps {
  /** The stored reference: a durable path from an upload, or a pasted URL. */
  value: string;
  onChange: (value: string) => void;
  /**
   * US-013's `seoProUnlocked`, resolved server-side from `tenants.plan`. Shows
   * or hides the upload control only — see the module note on why there is no
   * server gate behind it.
   */
  canUpload: boolean;
  /**
   * Where a picked file is posted. Defaults to the tenant-scoped upload route.
   *
   * US-014 — the platform SEO editor passes `/api/platform/upload`, which is
   * `withSuperAdmin` and files bytes under the platform's own S3 prefix. The
   * tenant route would refuse a super-admin outright (it reads `tenantId` off
   * the user and 403s when there isn't one) or, under impersonation, file
   * budstacks.io's own social card inside somebody's store.
   */
  uploadEndpoint?: string;
}

export function OgImageField({
  value,
  onChange,
  canUpload,
  uploadEndpoint = OG_IMAGE_UPLOAD_URL,
}: OgImageFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [size, setSize] = useState<ImageSize | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  // A measurement belongs to ONE image. Without this reset, the warning from
  // the previous URL survives onto the next one — indefinitely, if the new one
  // never loads and so never fires onLoad.
  useEffect(() => {
    setSize(null);
    setPreviewFailed(false);
  }, [value]);

  const sizeWarning = ogImageSizeWarning(size);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared before the await so picking the SAME file again after a failure
    // still fires a change event.
    event.target.value = "";
    if (!file) return;

    const problem = ogImageFileError(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsUploading(true);
    try {
      // The durable URL, never the presigned one — see og-image-upload.ts.
      onChange(await uploadOgImage(file, uploadEndpoint));
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The image could not be uploaded. Try again in a moment.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="seo-og-image" className="bs-eyebrow flex items-center gap-2">
        <span>Open Graph Image</span>
        <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
          ({OG_IMAGE_WIDTH}x{OG_IMAGE_HEIGHT} recommended)
        </span>
      </label>

      <div className="flex gap-2">
        <input
          id="seo-og-image"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com/image.jpg"
          className="bs-input flex-1"
        />
        {canUpload && (
          <div className="relative">
            <button
              type="button"
              disabled={isUploading}
              className="bs-btn bs-btn-ghost h-10 w-10 px-0 disabled:opacity-50"
              aria-hidden="true"
              tabIndex={-1}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {/* The input overlays the button and takes the click, so there is
                one control and no ref plumbing — the same shape the Wire post
                form uses for its cover image. */}
            <input
              type="file"
              className="absolute inset-0 cursor-pointer opacity-0"
              accept={OG_IMAGE_ACCEPT}
              onChange={handleFile}
              disabled={isUploading}
              aria-label="Upload an Open Graph image"
            />
          </div>
        )}
      </div>

      {canUpload ? (
        <p className="text-xs text-bs-fg-muted">
          Paste a URL, or upload a PNG, JPEG, GIF or WebP up to{" "}
          {OG_IMAGE_MAX_LABEL}. An uploaded image is stored on this site, so it
          keeps working — a link that expires shows nothing at all.
        </p>
      ) : (
        <p className="text-xs text-bs-fg-muted">
          Paste the URL of an image. Uploading one here is part of Pro —{" "}
          <Link href={UPGRADE_PATH} className="underline hover:text-bs-fg">
            {UPGRADE_CTA_LABEL}
          </Link>
          .
        </p>
      )}

      {value && (
        <div className="mt-2 space-y-2">
          {previewFailed ? (
            <p className="text-xs text-bs-warn">
              That image could not be previewed here. A scraper fetches the card
              directly, so an image hosted elsewhere may still work — but one
              uploaded to your own store always will.
            </p>
          ) : (
            <div className="overflow-hidden rounded-bs-md border border-bs-border-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Open Graph preview"
                className="h-32 w-full object-cover"
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  setSize(
                    naturalWidth > 0 && naturalHeight > 0
                      ? { width: naturalWidth, height: naturalHeight }
                      : null,
                  );
                }}
                onError={() => {
                  setSize(null);
                  setPreviewFailed(true);
                }}
              />
            </div>
          )}
          {size && (
            <p className="text-xs text-bs-fg-muted">
              This image is {size.width}x{size.height}.
            </p>
          )}
          {sizeWarning && <p className="text-xs text-bs-warn">{sizeWarning}</p>}
        </div>
      )}
    </div>
  );
}
