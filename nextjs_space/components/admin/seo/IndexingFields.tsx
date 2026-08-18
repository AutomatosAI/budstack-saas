"use client";

/**
 * SEO Supercharge US-022 — the Indexing section of the SEO editor.
 *
 * WHAT IT WRITES, and where it lands: three keys in the same authored `seo`
 * record as the title and description (`lib/seo/entity-seo.ts`), read back by
 * every storefront metadata builder and by the sitemap. Nothing here is a
 * column of its own.
 *
 * THE LOCK IS PRESENTATION — unlike `OgImageField`, this one HAS a server gate
 * underneath it: every SEO PUT route 403s `upgrade_required` when a Basic
 * tenant sends any of these fields (`hasIndexingFields` + `featureDenial`). The
 * Basic arm therefore sends none of them, which is also what stops a save from
 * erasing rules a tenant configured while they were on Pro — those stay stored
 * and dormant, and this component says so rather than pretending they are gone.
 *
 * The copy in the locked state is `SEO_PRO_FEATURES`' own entry, so the upsell
 * page and this card cannot describe the feature differently.
 */

import Link from "next/link";

import { UPGRADE_CTA_LABEL, UPGRADE_PATH } from "@/lib/entitlements/upgrade";
import {
  CANONICAL_OVERRIDE_MAX_LENGTH,
  isCanonicalOverrideUrl,
} from "@/lib/seo/entity-seo";
import { SEO_PRO_FEATURES } from "@/lib/seo/pro-features";
import { LockedFeatureCard } from "./LockedFeatureCard";

/** The editor's own view of the three controls — booleans, never undefined. */
export interface IndexingValue {
  readonly noindex: boolean;
  readonly nofollow: boolean;
  readonly canonicalOverride: string;
  readonly sitemapExclude: boolean;
}

/**
 * The four controls as keys, so a surface can say which of them it STORES.
 *
 * Added for US-014's platform SEO editor: `platform_seo_settings` has a
 * `noindex` column and no others, so offering the remaining three there would
 * ship exactly the write-only control this workstream exists to remove. The
 * default is all four, which is what every tenant editor passes.
 */
export const INDEXING_FIELD_KEYS = [
  "noindex",
  "nofollow",
  "sitemapExclude",
  "canonicalOverride",
] as const;

export type IndexingFieldKey = (typeof INDEXING_FIELD_KEYS)[number];

/** True when the tenant has an indexing rule stored, whatever their plan. */
export function hasIndexingValue(value: IndexingValue): boolean {
  return (
    value.noindex ||
    value.nofollow ||
    value.sitemapExclude ||
    value.canonicalOverride.trim().length > 0
  );
}

/**
 * Why this canonical override cannot be saved, or null when it can.
 *
 * The same rule the route enforces (`isCanonicalOverrideUrl`), applied here so
 * the owner is told what is wrong with the URL they typed instead of meeting a
 * generic "failed to save" after the round trip.
 */
export function canonicalOverrideError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isCanonicalOverrideUrl(trimmed)
    ? null
    : "Enter a full https:// URL, for example https://example.com/page.";
}

const INDEXING_FEATURE = SEO_PRO_FEATURES.find(
  (feature) => feature.id === "indexing",
);

interface IndexingFieldsProps {
  value: IndexingValue;
  onChange: (value: IndexingValue) => void;
  /** US-013's `seoProUnlocked`, resolved server-side from `tenants.plan`. */
  canEdit: boolean;
  /** What to call the thing being edited in the copy — "product", "page"… */
  entityType: string;
  /** Which controls this surface stores. Defaults to all four. */
  fields?: readonly IndexingFieldKey[];
}

interface IndexingToggleProps {
  id: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label: string;
  description: string;
}

function IndexingToggle({
  id,
  checked,
  onToggle,
  label,
  description,
}: IndexingToggleProps) {
  return (
    <div
      className={`rounded-bs-md border p-3 ${
        checked ? "border-bs-green/40 bg-bs-green/10" : "border-bs-border-100"
      }`}
    >
      <label className="flex cursor-pointer gap-2.5" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-0.5"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-bs-fg">{label}</span>
          <span className="block text-xs text-bs-fg-muted">{description}</span>
        </span>
      </label>
    </div>
  );
}

export function IndexingFields({
  value,
  onChange,
  canEdit,
  entityType,
  fields = INDEXING_FIELD_KEYS,
}: IndexingFieldsProps) {
  const shows = (field: IndexingFieldKey) => fields.includes(field);

  if (!canEdit) {
    return (
      <div className="space-y-2">
        <LockedFeatureCard
          locked
          title="Indexing controls"
          valueProp={
            INDEXING_FEATURE?.valueProp ??
            "Per-page noindex and canonical overrides."
          }
        />
        {hasIndexingValue(value) && (
          <p className="text-xs text-bs-fg-muted">
            This {entityType} has indexing rules saved from Pro. They are not
            being applied on your current plan, and saving here will not delete
            them —{" "}
            <Link href={UPGRADE_PATH} className="underline hover:text-bs-fg">
              {UPGRADE_CTA_LABEL}
            </Link>{" "}
            to turn them back on.
          </p>
        )}
      </div>
    );
  }

  const overrideError = canonicalOverrideError(value.canonicalOverride);

  return (
    <div className="space-y-3">
      <div>
        <span className="bs-eyebrow">Indexing</span>
        <p className="text-xs text-bs-fg-muted">
          What search engines are allowed to do with this {entityType}. Leave
          everything off unless you have a reason — these settings can remove a
          page from search results.
        </p>
      </div>

      {shows("noindex") && (
        <IndexingToggle
          id="seo-noindex"
          checked={value.noindex}
          onToggle={(noindex) => onChange({ ...value, noindex })}
          label="Hide from search results (noindex)"
          description="Search engines are asked to drop this page from their index. It stays reachable to anyone with the link."
        />
      )}

      {shows("nofollow") && (
        <IndexingToggle
          id="seo-nofollow"
          checked={value.nofollow}
          onToggle={(nofollow) => onChange({ ...value, nofollow })}
          label="Do not follow links on this page (nofollow)"
          description="Search engines are asked not to pass ranking on to the pages this one links to."
        />
      )}

      {shows("sitemapExclude") && (
        <IndexingToggle
          id="seo-sitemap-exclude"
          checked={value.sitemapExclude}
          onToggle={(sitemapExclude) => onChange({ ...value, sitemapExclude })}
          label="Leave out of the sitemap"
          description="The URL stops being advertised in your store's sitemap. On its own this does not remove an already-indexed page — pair it with noindex for that."
        />
      )}

      {shows("canonicalOverride") && (
        <div className="space-y-2">
          <label htmlFor="seo-canonical-override" className="bs-eyebrow">
            Canonical URL
          </label>
          <input
            id="seo-canonical-override"
            value={value.canonicalOverride}
            onChange={(event) =>
              onChange({ ...value, canonicalOverride: event.target.value })
            }
            placeholder="https://example.com/the-original-page"
            maxLength={CANONICAL_OVERRIDE_MAX_LENGTH}
            className={`bs-input w-full ${overrideError ? "border-bs-warn" : ""}`}
          />
          {overrideError ? (
            <p className="text-xs text-bs-warn">{overrideError}</p>
          ) : (
            <p className="text-xs text-bs-fg-muted">
              Points search engines at the page that owns this content, when it
              lives somewhere else. Leave empty to use this {entityType}&apos;s
              own URL, which is almost always what you want.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
