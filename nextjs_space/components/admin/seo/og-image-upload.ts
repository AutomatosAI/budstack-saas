"use client";

/**
 * SEO Supercharge US-019 — picking a file in the SEO editor, and the social
 * card still resolving a month after it was saved.
 *
 * THE DURABLE URL IS THE WHOLE POINT, for the same reason it is in
 * `components/admin/email/email-image-upload.ts`: `/api/tenant-admin/upload`
 * answers with two addresses for one object — `url`, a presigned S3 link that
 * stops resolving about an hour later, and `publicUrl`, Email US-005's durable
 * `/api/public/images/<key>` path. A scraper fetches `og:image` whenever
 * somebody shares the link, which may be weeks after the page was saved, so
 * this module takes `publicUrl` and REFUSES to fall back to `url`. A presigned
 * URL in a meta tag is the worst shape of broken: it previews correctly for the
 * owner who pasted it and 403s for every person who ever sees the link.
 *
 * That refusal is not only a convention here — `lib/storage/public-image-url.ts`
 * DROPS a signed URL rather than render it (`storedPublicImagePath`), so an
 * `ogImage` holding one produces no tag at all. Falling back would therefore
 * store a value the storefront silently discards.
 *
 * WHAT GETS STORED IS ORIGIN-RELATIVE, exactly as US-005 generates it.
 * `storedPublicImagePath` passes it through untouched and Next absolutises it
 * against the store layout's `metadataBase` (US-001), so the rendered tag is
 * absolute — as every scraper requires — and points at the tenant's own host.
 *
 * RESTATED, NOT IMPORTED. The email module solves the same problem, but it is
 * bound to the composer: it imports `@/lib/email/email-image-node`, which pulls
 * @tiptap/core into any bundle that touches it, and every message it throws is
 * worded for an inbox. What is shared instead is the CONSTRAINT —
 * `tests/unit/og-image-upload.test.ts` walks the types offered here through
 * both server modules that could refuse one, so the restatement cannot drift.
 */

import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/seo/og-image";

/** The shared tenant-scoped upload endpoint (blog covers and logos use it too). */
export const OG_IMAGE_UPLOAD_URL = "/api/tenant-admin/upload";

/**
 * Client-side ceiling, half the server's 10MB (`UPLOAD_MAX_FILE_SIZE`).
 *
 * The binding limit is not ours: X and LinkedIn both stop fetching an `og:image`
 * over 5MB, so a 9MB card the upload route happily accepts is a card that never
 * renders anywhere it matters. Told to the owner before the upload rather than
 * discovered when a link looks bare.
 */
export const OG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The types offered, which MUST stay a subset of two server-side lists: the
 * upload route's magic-byte allow-list (`lib/storage/upload-validation.ts`) and
 * US-005's servable set (`lib/storage/public-image-url.ts`). Restated rather
 * than imported because both of those modules reach `@/lib/api-error` and
 * `file-type`, which have no business in a browser bundle.
 *
 * SVG is absent for the reason it is absent everywhere else in this codebase:
 * it is XML and can carry script.
 */
export const OG_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** `accept` for the file input — the picker then hides everything else. */
export const OG_IMAGE_ACCEPT = OG_IMAGE_TYPES.join(",");

/**
 * Below this a scraper downgrades the post to a small thumbnail card instead of
 * the large one this whole feature exists to produce (X's documented floor for
 * `summary_large_image`; Facebook's is lower but degrades the same way).
 */
export const OG_IMAGE_MIN_WIDTH = 600;
export const OG_IMAGE_MIN_HEIGHT = 315;

/**
 * How far from 1.91:1 an image may sit before the crop starts eating content.
 * A tenth is roughly the difference between 1200x630 and 1200x700 — visible,
 * but not yet a headline sliced in half.
 */
const OG_IMAGE_RATIO_TOLERANCE = 0.1;

const OG_IMAGE_RATIO = OG_IMAGE_WIDTH / OG_IMAGE_HEIGHT;

const UPLOAD_FAILED_MESSAGE =
  "The image could not be uploaded. Try again in a moment.";
const NO_DURABLE_URL_MESSAGE =
  "That file cannot be used as a social image. Upload a PNG, JPEG, GIF or WebP.";
const WRONG_TYPE_MESSAGE =
  "That file is not an image a social card can show. Use a PNG, JPEG, GIF or WebP.";

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the size limit is called in the UI. */
export const OG_IMAGE_MAX_LABEL = formatMegabytes(OG_IMAGE_MAX_BYTES);

/** Structural, so the rules can be asserted without constructing a real File. */
export interface OgImageFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

/**
 * Why this file cannot be used, in words an owner can act on, or null.
 *
 * Client-side only. The authority is the upload route, which re-checks the type
 * against the file's MAGIC BYTES — a check no browser can be trusted to do,
 * since `file.type` is taken from the extension.
 */
export function ogImageFileError(file: OgImageFile): string | null {
  if (!(OG_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return WRONG_TYPE_MESSAGE;
  }
  if (file.size > OG_IMAGE_MAX_BYTES) {
    return `That image is ${formatMegabytes(file.size)}. A social image needs to be under ${OG_IMAGE_MAX_LABEL} — X and LinkedIn stop fetching above that.`;
  }
  return null;
}

/**
 * Upload one image and return its DURABLE URL, or throw a message written for
 * the owner. Never returns the presigned `url` — see the module note.
 */
export async function uploadOgImage(
  file: File,
  uploadUrl: string = OG_IMAGE_UPLOAD_URL,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch(uploadUrl, { method: "POST", body });
  } catch {
    // A dropped connection throws a TypeError whose message ("Failed to fetch")
    // is the browser's wording, not ours. Everything else this module throws is
    // written for the owner, so this is too.
    throw new Error(UPLOAD_FAILED_MESSAGE);
  }

  const payload = (await response.json().catch(() => null)) as {
    publicUrl?: unknown;
    error?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string" ? payload.error : UPLOAD_FAILED_MESSAGE,
    );
  }

  const publicUrl =
    typeof payload?.publicUrl === "string" ? payload.publicUrl.trim() : "";
  if (!publicUrl) throw new Error(NO_DURABLE_URL_MESSAGE);
  return publicUrl;
}

/** Intrinsic pixels of the image currently previewed. */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The 1200x630 guidance, applied to the image actually chosen — or null when
 * there is nothing to say.
 *
 * A WARNING, never a rejection: the owner's image is theirs, and an off-ratio
 * card still beats no card. Both branches name the measured size, because
 * "1200x630 recommended" under a field tells someone nothing about the file
 * they just picked.
 */
export function ogImageSizeWarning(size: ImageSize | null): string | null {
  if (!size || size.width <= 0 || size.height <= 0) return null;

  if (size.width < OG_IMAGE_MIN_WIDTH || size.height < OG_IMAGE_MIN_HEIGHT) {
    return `That image is ${size.width}x${size.height}. Under ${OG_IMAGE_MIN_WIDTH}x${OG_IMAGE_MIN_HEIGHT} it is shown as a small thumbnail rather than a full-width card — ${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT} is the size to aim for.`;
  }

  const ratio = size.width / size.height;
  if (Math.abs(ratio - OG_IMAGE_RATIO) / OG_IMAGE_RATIO > OG_IMAGE_RATIO_TOLERANCE) {
    return `That image is ${size.width}x${size.height}. Social cards are cropped to ${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}, so the edges of this one will be cut off.`;
  }

  return null;
}
