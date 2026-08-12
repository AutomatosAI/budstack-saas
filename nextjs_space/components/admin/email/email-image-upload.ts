"use client";

/**
 * US-014 — picking or dropping an image in the composer and having it work in
 * the sent email.
 *
 * THE DURABLE URL IS THE WHOLE POINT. `/api/tenant-admin/upload` answers with
 * two addresses for the same object: `url`, a presigned S3 link that stops
 * resolving about an hour later, and `publicUrl`, US-005's durable
 * `/api/public/images/<key>` path. An email is read days after it is written and
 * cannot be re-signed, so this module takes `publicUrl` and REFUSES to fall back
 * to `url` — an image that works in the preview and 403s in the recipient's
 * inbox is worse than being told at upload time. (`the-wire/post-form.tsx` does
 * fall back, deliberately: a blog page re-renders and can be fixed in place.)
 *
 * The stored src stays origin-relative, exactly as US-005 generates it;
 * `lib/email/email-content-json.ts` absolutises it against the tenant's own base
 * URL on the save path, which is the only place that knows which tenant's host
 * the message will claim to come from.
 */

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

import {
  constrainEmailImageWidth,
  EMAIL_IMAGE_NAME,
} from "@/lib/email/email-image-node";

/**
 * Client-side ceiling, well under the server's 10MB
 * (`UPLOAD_MAX_FILE_SIZE`). An email carrying a 6MB image is not rejected by
 * the upload route but it is by mail providers, and Gmail clips a message over
 * 102KB of HTML regardless — so the limit that matters is the one an author is
 * told about before they wait for the upload.
 */
export const EMAIL_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The types offered, which MUST stay a subset of two server-side lists: the
 * upload route's magic-byte allow-list (`lib/storage/upload-validation.ts`) and
 * US-005's servable set (`lib/storage/public-image-url.ts`). Restated rather
 * than imported because both of those modules reach `@/lib/api-error` and
 * `file-type`, which have no business in a browser bundle — the same reason
 * `EMAIL_BUTTON_BACKGROUND_COLOR` is restated in `lib/email/email-button-node.ts`.
 *
 * The drift that restating invites is closed by a test:
 * `tests/unit/email-image-upload.test.ts` walks this list through both server
 * modules and fails if either one would refuse a type offered here.
 *
 * SVG is absent for the reason it is absent everywhere else in this codebase:
 * it is XML and can carry script.
 */
export const EMAIL_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** `accept` for the file input — the picker then hides everything else. */
export const EMAIL_IMAGE_ACCEPT = EMAIL_IMAGE_TYPES.join(",");

/** Longest alt text derived from a filename. Beyond this it is not a label. */
const ALT_MAX_LENGTH = 120;

/**
 * Give up measuring rather than leave the author waiting on a dead host.
 *
 * Short on purpose: an insert waits on this, and an image that has not decoded
 * in two and a half seconds is either a local blob (which decodes in
 * milliseconds) or a host that is not going to answer. Timing out costs the
 * width attribute, not the image.
 */
const MEASURE_TIMEOUT_MS = 2_500;

const UPLOAD_FAILED_MESSAGE =
  "The image could not be uploaded. Try again in a moment.";
const NO_DURABLE_URL_MESSAGE =
  "That file cannot be shown in an email. Upload a PNG, JPEG, GIF or WebP image.";
const WRONG_TYPE_MESSAGE =
  "That file is not an image an email can show. Use a PNG, JPEG, GIF or WebP.";

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the size limit is called in the UI. */
export const EMAIL_IMAGE_MAX_LABEL = formatMegabytes(EMAIL_IMAGE_MAX_BYTES);

/** Structural, so the rules can be asserted without constructing a real File. */
export interface EmailImageFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

/**
 * Why this file cannot be used, in words an admin can act on, or null.
 *
 * Client-side only. The authority is the upload route, which re-checks the type
 * against the file's MAGIC BYTES — a check no browser can be trusted to do,
 * since `file.type` is taken from the extension.
 */
export function emailImageFileError(file: EmailImageFile): string | null {
  if (!(EMAIL_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return WRONG_TYPE_MESSAGE;
  }
  if (file.size > EMAIL_IMAGE_MAX_BYTES) {
    return `That image is ${formatMegabytes(file.size)}. Images in an email need to be under ${EMAIL_IMAGE_MAX_LABEL} — try a smaller one.`;
  }
  return null;
}

/** Alt text from a filename: `summer-range_2.jpg` → `summer range 2`. */
export function emailImageAlt(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, ALT_MAX_LENGTH);
}

/**
 * Upload one image and return its DURABLE URL, or throw a message written for
 * the author. Never returns the presigned `url` — see the module note.
 */
export async function uploadEmailImage(
  file: File,
  uploadUrl: string,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(uploadUrl, { method: "POST", body });
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

/**
 * Intrinsic width of an image, or null if it cannot be read.
 *
 * Null is a normal outcome, not a failure: a pasted third-party URL is loaded
 * from the admin origin, where `img-src` may refuse it. The image is then
 * inserted with no width attribute, which is the pre-US-014 behaviour.
 */
export function measureImageWidth(src: string): Promise<number | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const probe = new window.Image();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (width: number | null) => {
      if (timer !== undefined) clearTimeout(timer);
      probe.onload = null;
      probe.onerror = null;
      resolve(width);
    };

    timer = setTimeout(() => finish(null), MEASURE_TIMEOUT_MS);
    probe.onload = () => finish(probe.naturalWidth > 0 ? probe.naturalWidth : null);
    probe.onerror = () => finish(null);
    probe.src = src;
  });
}

/**
 * Measure a local file, before it is uploaded. Reading the blob costs nothing
 * and gives an answer even if the upload later fails, which is why the upload
 * path measures the file rather than the URL it comes back with.
 */
export async function measureFileWidth(file: Blob): Promise<number | null> {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await measureImageWidth(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface EmailImageInsert {
  readonly src: string;
  readonly alt?: string;
  /** Intrinsic width; clamped to the column here, or null to leave unsized. */
  readonly width?: number | null;
}

/**
 * Insert an image, sized to the shell's content column.
 *
 * `insertContent` rather than the `setImage` command: that command's argument
 * is typed to the upstream attributes (src/alt/title), so it cannot carry the
 * `width` US-014 added in `lib/email/email-image-node.ts`.
 */
export function insertEmailImage(editor: Editor, image: EmailImageInsert): void {
  editor
    .chain()
    .focus()
    .insertContent({
      type: EMAIL_IMAGE_NAME,
      attrs: {
        src: image.src,
        alt: image.alt?.trim() || null,
        width: constrainEmailImageWidth(image.width),
      },
    })
    .run();
}

/** Upload one file and place it. Reports its own failure; never throws. */
async function uploadAndInsert(
  editor: Editor,
  file: File,
  uploadUrl: string,
): Promise<boolean> {
  const problem = emailImageFileError(file);
  if (problem) {
    toast.error(problem);
    return false;
  }

  try {
    const width = await measureFileWidth(file);
    const src = await uploadEmailImage(file, uploadUrl);
    // The author can switch to the HTML pane, or leave the page, while an
    // upload is in flight. Dispatching into a destroyed editor throws from
    // inside ProseMirror, and the message that reached the toast was the
    // internal one; there is simply nowhere to put the image now.
    if (editor.isDestroyed) return false;
    insertEmailImage(editor, { src, alt: emailImageAlt(file.name), width });
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : UPLOAD_FAILED_MESSAGE);
    return false;
  }
}

/**
 * Images out of a drag payload.
 *
 * Any `image/*` is taken, not just the four offered types: a dropped SVG or
 * TIFF is a file the author plainly meant as a picture, so it is claimed and
 * then refused with a reason. Leaving it to the browser would open it in the
 * tab and lose the draft. Anything that is not an image at all is not claimed —
 * dragging a link or selected text keeps working as it always did.
 */
export function droppedImageFiles(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []).filter((file) =>
    file.type.startsWith("image/"),
  );
}

/** The parts of a drop event this handler needs, so it can be called directly. */
export interface EmailImageDropEvent {
  readonly dataTransfer: DataTransfer | null;
  readonly preventDefault: () => void;
}

/**
 * ProseMirror's `handleDrop` contract: true means "handled, stop processing".
 *
 * Lives here rather than inline in the composer so the two decisions it makes —
 * whether the drop is ours, and whether the browser's default is suppressed —
 * can be asserted without a DOM. Declining leaves ProseMirror's own drop
 * handling untouched.
 */
export function handleEmailImageDrop(
  upload: Pick<EmailImageUpload, "acceptDrop">,
  editor: Editor | null,
  event: EmailImageDropEvent,
): boolean {
  if (!editor) return false;
  if (!upload.acceptDrop(editor, event.dataTransfer)) return false;
  event.preventDefault();
  return true;
}

export interface EmailImageUpload {
  /** False when no upload endpoint was supplied — the UI then offers only a URL. */
  readonly enabled: boolean;
  readonly uploading: boolean;
  /** Uploads and inserts each file; resolves with how many landed. */
  readonly uploadFiles: (
    editor: Editor,
    files: readonly File[],
  ) => Promise<number>;
  /** Takes a drop's images if there are any, synchronously, for ProseMirror. */
  readonly acceptDrop: (editor: Editor, transfer: DataTransfer | null) => boolean;
}

/**
 * `uploadUrl` is optional because the composer is shared with the super-admin
 * screens, where it has no endpoint to use: `/api/tenant-admin/upload` derives
 * its tenant from the signed-in user and 403s a super-admin who has none, and a
 * SYSTEM template is rendered with no base URL, so an origin-relative src could
 * not be absolutised for it anyway. There, uploading is not offered at all
 * rather than offered and broken.
 */
export function useEmailImageUpload(uploadUrl?: string): EmailImageUpload {
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (editor: Editor, files: readonly File[]): Promise<number> => {
      if (!uploadUrl || files.length === 0) return 0;

      setUploading(true);
      try {
        // Sequential: parallel uploads finish in arrival order and each inserts
        // at the caret, so a batch would land in an order nobody chose.
        let inserted = 0;
        for (const file of files) {
          if (await uploadAndInsert(editor, file, uploadUrl)) inserted += 1;
        }
        return inserted;
      } finally {
        setUploading(false);
      }
    },
    [uploadUrl],
  );

  const acceptDrop = useCallback(
    (editor: Editor, transfer: DataTransfer | null): boolean => {
      const images = droppedImageFiles(transfer);
      if (!uploadUrl || images.length === 0) return false;
      void uploadFiles(editor, images);
      return true;
    },
    [uploadUrl, uploadFiles],
  );

  return { enabled: Boolean(uploadUrl), uploading, uploadFiles, acceptDrop };
}
