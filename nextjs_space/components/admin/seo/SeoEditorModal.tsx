"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AiAssistButton, AutomatosConnectCard } from "./AiAssistButton";
import { GooglePreview } from "./GooglePreview";
import {
  IndexingFields,
  canonicalOverrideError,
  type IndexingValue,
} from "./IndexingFields";
import { OgImageField } from "./OgImageField";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { EntitySeo } from "@/lib/seo/entity-seo";

/**
 * The authored record as it crosses the wire. Structurally the parsed
 * `EntitySeo`, so the editor and the storefront cannot disagree about the shape
 * — US-022's indexing keys included.
 */
type SeoData = EntitySeo;

/** The three indexing controls, unpacked from a stored record for the form. */
function readIndexingValue(seo: SeoData | undefined): IndexingValue {
  return {
    noindex: seo?.robots?.noindex === true,
    nofollow: seo?.robots?.nofollow === true,
    canonicalOverride: seo?.canonicalOverride ?? "",
    sitemapExclude: seo?.sitemapExclude === true,
  };
}

/**
 * The same three controls as the keys a PUT route accepts.
 *
 * Sent ONLY by an entitled tenant (see the save handler): the routes 403 a
 * Basic tenant that includes them, and omitting them is also what makes a Basic
 * save preserve whatever rules are already stored.
 */
function indexingPayload(value: IndexingValue): Partial<SeoData> {
  return {
    robots: { noindex: value.noindex, nofollow: value.nofollow },
    canonicalOverride: value.canonicalOverride.trim(),
    sitemapExclude: value.sitemapExclude,
  };
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
  /**
   * US-019 — US-013's `seoProUnlocked`, resolved server-side from
   * `tenants.plan`. Shows the OG image upload control; the URL field beside it
   * belongs to Basic and is never hidden. See `OgImageField` for why this one
   * Pro line has no server gate behind it.
   */
  canUploadOgImage?: boolean;
  /**
   * US-022 — the same `seoProUnlocked`, for the indexing controls. Unlike the
   * OG upload above, this one IS backed by a server gate: a Basic tenant that
   * sends `robots`, `canonicalOverride` or `sitemapExclude` is 403'd by the
   * route, which is why the save below omits them entirely when this is false.
   */
  canEditIndexing?: boolean;
  /**
   * US-025 — `seoProUnlocked` again, for the AI drafting buttons. Backed by
   * `requireFeature(SEO_PRO)` on `/api/tenant-admin/seo/ai-assist`.
   */
  canUseAiAssist?: boolean;
  /**
   * US-025 — does this tenant have Automatos credentials stored? Resolved
   * server-side (page.tsx) so an unconnected tenant sees the connect card
   * immediately, instead of a button whose only possible answer is "connect an
   * account". A click that discovers otherwise flips the same state locally.
   */
  aiAssistConnected?: boolean;
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
  canUploadOgImage = false,
  canEditIndexing = false,
  canUseAiAssist = false,
  aiAssistConnected = false,
}: SeoEditorModalProps) {
  const [title, setTitle] = useState(initialSeo?.title || "");
  const [description, setDescription] = useState(initialSeo?.description || "");
  const [ogImage, setOgImage] = useState(initialSeo?.ogImage || "");
  const [imageAlt, setImageAlt] = useState(initialSeo?.imageAlt || "");
  const [indexing, setIndexing] = useState<IndexingValue>(() =>
    readIndexingValue(initialSeo),
  );
  const [isSaving, setIsSaving] = useState(false);
  /**
   * US-025 — starts from what the server resolved, and is flipped by a click
   * that comes back `unavailable` (the credentials were removed since this page
   * rendered). One piece of state for all three buttons, so the connect card
   * appears once rather than under every field.
   */
  const [aiConnected, setAiConnected] = useState(aiAssistConnected);

  const showAltText = (ALT_TEXT_ENTITY_TYPES as readonly string[]).includes(
    entityType,
  );
  const showAiAssist = canUseAiAssist && aiConnected;

  useEffect(() => {
    setTitle(initialSeo?.title || "");
    setDescription(initialSeo?.description || "");
    setOgImage(initialSeo?.ogImage || "");
    setImageAlt(initialSeo?.imageAlt || "");
    setIndexing(readIndexingValue(initialSeo));
  }, [initialSeo, isOpen]);

  // The prop is authoritative again whenever the editor is reopened: a tenant
  // who adds a key in Settings and comes back sees the buttons without a reload.
  useEffect(() => {
    setAiConnected(aiAssistConnected);
  }, [aiAssistConnected, isOpen]);

  // A canonical the route would reject: the save is blocked here so the owner
  // sees WHICH field is wrong rather than a generic failure toast.
  const blockedByCanonical =
    canEditIndexing && canonicalOverrideError(indexing.canonicalOverride) !== null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // The key is omitted entirely for the types that do not offer the field:
      // their write routes parse `.strict()` and have no `imageAlt` in the
      // schema, so sending one would 400 the save. The indexing keys are
      // omitted for the same reason a Basic tenant must not send them — the
      // route 403s that request, and an absent key is what preserves whatever
      // rules are already stored.
      await onSave({
        title,
        description,
        ogImage,
        ...(showAltText ? { imageAlt } : {}),
        ...(canEditIndexing ? indexingPayload(indexing) : {}),
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

          {/* US-025 — one card for the whole editor, not one per field. Shown
              to a Pro tenant with no Automatos credentials stored; it points at
              Settings, NOT at the upgrade page (they already bought Pro). */}
          {canUseAiAssist && !aiConnected && <AutomatosConnectCard />}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="seo-title" className="bs-eyebrow flex items-center gap-2">
                <span>Meta Title</span>
                <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                  ({title.length}/60 recommended)
                </span>
              </label>
              {/* Sibling of the label, never inside it: a <label> wrapping a
                  button swallows the click into the input it labels. */}
              {showAiAssist && (
                <AiAssistButton
                  kind="title"
                  entityType={entityType}
                  entityId={entityId}
                  onDraft={setTitle}
                  onUnavailable={() => setAiConnected(false)}
                  disabled={isSaving}
                />
              )}
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="seo-description"
                className="bs-eyebrow flex items-center gap-2"
              >
                <span>Meta Description</span>
                <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                  ({description.length}/160 recommended)
                </span>
              </label>
              {showAiAssist && (
                <AiAssistButton
                  kind="description"
                  entityType={entityType}
                  entityId={entityId}
                  onDraft={setDescription}
                  onUnavailable={() => setAiConnected(false)}
                  disabled={isSaving}
                />
              )}
            </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="seo-image-alt"
                  className="bs-eyebrow flex items-center gap-2"
                >
                  <span>Image Alt Text</span>
                  <span className="text-[10px] normal-case tracking-normal text-bs-fg-muted">
                    ({imageAlt.length}/125 recommended)
                  </span>
                </label>
                {showAiAssist && (
                  <AiAssistButton
                    kind="imageAlt"
                    entityType={entityType}
                    entityId={entityId}
                    onDraft={setImageAlt}
                    onUnavailable={() => setAiConnected(false)}
                    disabled={isSaving}
                  />
                )}
              </div>
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

          <OgImageField
            value={ogImage}
            onChange={setOgImage}
            canUpload={canUploadOgImage}
          />

          <IndexingFields
            value={indexing}
            onChange={setIndexing}
            canEdit={canEditIndexing}
            entityType={entityType}
          />
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
            disabled={isSaving || blockedByCanonical}
            className="bs-btn bs-btn-green disabled:opacity-50"
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
