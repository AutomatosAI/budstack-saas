"use client";

/**
 * US-014 — the "choose an image" half of the composer's image dialog.
 *
 * Kept out of `EmailComposerDialog`, which serves the link and button tools
 * too and has no business knowing what an upload is: the dialog renders
 * whatever it is given above its fields, and only the image tool passes this.
 *
 * The dialog stays open while the upload runs and closes itself when an image
 * lands, so a failure leaves the author looking at the form they can retry from
 * — or at the address field, which is still there for an image already online.
 */

import React, { useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Loader2, Upload } from "lucide-react";

import {
  EMAIL_IMAGE_ACCEPT,
  EMAIL_IMAGE_MAX_LABEL,
  type EmailImageUpload,
} from "./email-image-upload";

export interface EmailImageUploadFieldProps {
  readonly editor: Editor;
  readonly upload: EmailImageUpload;
  /** Called once at least one image has been inserted. */
  readonly onUploaded: () => void;
}

export function EmailImageUploadField({
  editor,
  upload,
  onUploaded,
}: EmailImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Cleared before the await: without it, picking the same file twice in a row
    // is not a change and the second attempt does nothing.
    event.target.value = "";
    if (files.length === 0) return;
    if ((await upload.uploadFiles(editor, files)) > 0) onUploaded();
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={EMAIL_IMAGE_ACCEPT}
        multiple
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="email-image-input"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.uploading}
        className="bs-btn bs-btn-ghost w-full justify-center"
      >
        {upload.uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>Choose an image</span>
          </>
        )}
      </button>
      <p className="text-xs text-bs-fg-muted">
        PNG, JPEG, GIF or WebP, up to {EMAIL_IMAGE_MAX_LABEL}. You can also drag
        an image straight onto the message.
      </p>
    </div>
  );
}
