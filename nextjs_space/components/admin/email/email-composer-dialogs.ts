/**
 * The words the composer's three insert dialogs are made of.
 *
 * Lifted out of `EmailComposerToolbar` in US-014, which added a fourth string
 * and pushed that file past the point where its behaviour was readable through
 * its copy. Data, not behaviour: nothing here imports React or the editor.
 *
 * The copy is aimed at an admin who is not expected to know what a URL scheme
 * is — "Web address", never "URL"; "Description (for screen readers)", never
 * "alt".
 */

import { EMAIL_BUTTON_DEFAULT_LABEL } from "@/lib/email/email-button-node";

export type DialogKind = "link" | "image" | "button";

export interface ComposerDialogCopy {
  readonly title: string;
  readonly description: string;
  readonly urlLabel: string;
  readonly urlPlaceholder: string;
  /** Omit to hide the second field entirely (the link tool has no label). */
  readonly textLabel?: string;
  readonly textPlaceholder?: string;
  readonly submitLabel: string;
}

export const COMPOSER_DIALOGS: Readonly<Record<DialogKind, ComposerDialogCopy>> =
  {
    link: {
      title: "Add a link",
      description: "The words you enter become a link in the email.",
      textLabel: "Link text",
      textPlaceholder: "See what's new",
      urlLabel: "Web address",
      urlPlaceholder: "https://example.com/offers",
      submitLabel: "Add link",
    },
    image: {
      title: "Add an image",
      description:
        "Paste the address of an image that is already online. Email clients cannot show images that only exist on your computer.",
      textLabel: "Description (for screen readers)",
      textPlaceholder: "Our new summer range",
      urlLabel: "Image address",
      urlPlaceholder: "https://example.com/photo.jpg",
      submitLabel: "Add image",
    },
    button: {
      title: "Add a button",
      description:
        "A button is a link styled to stand out. Both parts are editable later.",
      textLabel: "Button text",
      textPlaceholder: EMAIL_BUTTON_DEFAULT_LABEL,
      urlLabel: "Web address",
      urlPlaceholder: "https://example.com/shop",
      submitLabel: "Add button",
    },
  };

/**
 * US-014 — what the image dialog says once it can upload. The stock line above
 * tells the author the files on their computer are unusable, which stops being
 * true the moment an upload endpoint is available.
 */
export const IMAGE_UPLOAD_DESCRIPTION =
  "Upload an image from your computer, or paste the address of one that is already online.";

/** The copy for a dialog, with the image tool's upload variant applied. */
export function composerDialogCopy(
  kind: DialogKind,
  canUpload: boolean,
): ComposerDialogCopy {
  const copy = COMPOSER_DIALOGS[kind];
  if (kind !== "image" || !canUpload) return copy;
  return { ...copy, description: IMAGE_UPLOAD_DESCRIPTION };
}
