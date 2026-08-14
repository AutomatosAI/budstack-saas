"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GooglePreview } from "./GooglePreview";
import { ImageIcon, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface SeoData {
  title?: string;
  description?: string;
  ogImage?: string;
  /** US-009 — alt text for the entity's own image (see `ALT_TEXT_ENTITY_TYPES`). */
  imageAlt?: string;
}

/**
 * US-009 — the entity types whose alt text a storefront page actually RENDERS:
 * a product's strain image (app/store/[slug]/products/[id]/product-detail-client
 * .tsx) and a Wire post's cover (app/store/[slug]/the-wire/…). Conditions and
 * static pages are left out deliberately — offering the field there would ship
 * another write-only column, which is the defect this workstream exists to
 * close, and their write routes replace `seo` wholesale so nothing is lost.
 */
const ALT_TEXT_ENTITY_TYPES = ["product", "post"] as const;

/** Per-type wording; the field describes a different picture in each tab. */
const ALT_TEXT_HINTS: Record<string, string> = {
  product: "Describe the strain photo — e.g. \"Dried Blue Dream flower in a glass jar\".",
  post: "Describe the cover image — e.g. \"Researcher examining cannabis plants in a greenhouse\".",
};

interface SeoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "product" | "post" | "page" | "condition";
  entityId: string;
  entityName: string;
  entitySlug: string;
  previewUrl: string;
  initialSeo?: SeoData;
  onSave: (seo: SeoData) => Promise<void>;
}

export function SeoEditorModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  entitySlug,
  previewUrl,
  initialSeo,
  onSave,
}: SeoEditorModalProps) {
  const [title, setTitle] = useState(initialSeo?.title || "");
  const [description, setDescription] = useState(initialSeo?.description || "");
  const [ogImage, setOgImage] = useState(initialSeo?.ogImage || "");
  const [imageAlt, setImageAlt] = useState(initialSeo?.imageAlt || "");
  const [isSaving, setIsSaving] = useState(false);

  const showAltText = (ALT_TEXT_ENTITY_TYPES as readonly string[]).includes(
    entityType,
  );

  useEffect(() => {
    setTitle(initialSeo?.title || "");
    setDescription(initialSeo?.description || "");
    setOgImage(initialSeo?.ogImage || "");
    setImageAlt(initialSeo?.imageAlt || "");
  }, [initialSeo, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // The key is omitted entirely for the types that do not offer the field:
      // their write routes parse `.strict()` and have no `imageAlt` in the
      // schema, so sending one would 400 the save.
      await onSave({
        title,
        description,
        ogImage,
        ...(showAltText ? { imageAlt } : {}),
      });
      toast.success("SEO settings saved successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to save SEO settings");
      console.error("SEO save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bs-dialog-content max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="font-display text-[22px] text-bs-fg"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            SEO Settings: {entityName}
          </DialogTitle>
          <p className="text-sm text-bs-fg-muted">
            Customize how this {entityType} appears in search engines and social
            media.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Google Preview — light Google-brand colours preserved (product output) */}
          <GooglePreview
            title={title || entityName}
            description={description || `Learn more about ${entityName}`}
            url={previewUrl}
          />

          <div className="space-y-2">
            <label htmlFor="seo-title" className="bs-eyebrow flex items-center gap-2">
              <span>Meta Title</span>
              <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                ({title.length}/60 recommended)
              </span>
            </label>
            <input
              id="seo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={entityName}
              className={`bs-input w-full ${title.length > 60 ? "border-bs-warn" : ""}`}
            />
            <p className="text-xs text-bs-fg-muted">
              Leave empty to use: &quot;{entityName}&quot;
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="seo-description"
              className="bs-eyebrow flex items-center gap-2"
            >
              <span>Meta Description</span>
              <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                ({description.length}/160 recommended)
              </span>
            </label>
            <textarea
              id="seo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Learn more about ${entityName}...`}
              rows={3}
              className={`bs-input w-full resize-y ${description.length > 160 ? "border-bs-warn" : ""}`}
            />
          </div>

          {showAltText && (
            <div className="space-y-2">
              <label
                htmlFor="seo-image-alt"
                className="bs-eyebrow flex items-center gap-2"
              >
                <span>Image Alt Text</span>
                <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                  ({imageAlt.length}/125 recommended)
                </span>
              </label>
              <input
                id="seo-image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder={entityName}
                maxLength={300}
                className={`bs-input w-full ${imageAlt.length > 125 ? "border-bs-warn" : ""}`}
              />
              <p className="text-xs text-bs-fg-muted">
                What a screen reader announces, and what image search reads.{" "}
                {ALT_TEXT_HINTS[entityType]} Leave empty to fall back to
                &quot;{entityName}&quot;.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="seo-og-image" className="bs-eyebrow flex items-center gap-2">
              <span>Open Graph Image</span>
              <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                (1200x630 recommended)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="seo-og-image"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="bs-input flex-1"
              />
              <button
                type="button"
                disabled
                className="bs-btn bs-btn-ghost h-10 w-10 px-0"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-bs-fg-muted">
              Enter image URL or upload (upload coming soon)
            </p>
            {ogImage && (
              <div className="mt-2 overflow-hidden rounded-bs-md border border-bs-border-100">
                <img
                  src={ogImage}
                  alt="OG Preview"
                  className="h-32 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="10" y="30" fill="gray">Invalid Image</text></svg>';
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="bs-btn bs-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bs-btn bs-btn-green"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save SEO Settings</span>
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
