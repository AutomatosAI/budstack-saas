/**
 * SEO Supercharge US-002 — the ONE list of storefront pages a tenant can author
 * metadata for.
 *
 * THE DEFECT THIS CLOSES: three separate hardcoded lists disagreed with each
 * other and with the storefront. The admin offered `home | about | contact |
 * faq` (app/tenant-admin/seo/seo-page-client.tsx), the API accepted the same
 * four (app/api/tenant-admin/seo/pages/route.ts), and only `home` was ever read
 * by a rendered page — so an owner could write About and Contact metadata that
 * nothing displayed, and FAQ metadata for a URL that has redirected to /support
 * since app/store/[slug]/faq/page.tsx became a `redirect()`.
 *
 * Everything now derives from `STORE_SEO_PAGE_KEYS`: the admin list, the Zod
 * enum on the write route, and the pages that render the result. Adding a page
 * is one edit here plus a `generateMetadata` on the page itself.
 *
 * Deliberately dependency-free (no zod, no next, no prisma): a client component
 * imports it for the admin list, and the storefront imports it inside
 * `generateMetadata`, which renders with no error.tsx boundary above it.
 */

import { seoText } from "@/lib/seo/store-identity";

/** The authorable pages. The write route's Zod enum is built from this tuple. */
export const STORE_SEO_PAGE_KEYS = [
  "home",
  "about",
  "contact",
  "support",
  "conditions",
] as const;

export type StoreSeoPageKey = (typeof STORE_SEO_PAGE_KEYS)[number];

export interface StoreSeoPage {
  readonly key: StoreSeoPageKey;
  /** Label shown in the SEO Manager. */
  readonly name: string;
  /** Store-relative path, "" for the homepage. Also the canonical path. */
  readonly path: string;
}

export const STORE_SEO_PAGES: readonly StoreSeoPage[] = [
  { key: "home", name: "Homepage", path: "" },
  { key: "about", name: "About Us", path: "/about" },
  { key: "contact", name: "Contact", path: "/contact" },
  { key: "support", name: "Support & FAQ", path: "/support" },
  { key: "conditions", name: "Conditions", path: "/conditions" },
];

const PAGE_BY_KEY: ReadonlyMap<StoreSeoPageKey, StoreSeoPage> = new Map(
  STORE_SEO_PAGES.map((page) => [page.key, page]),
);

export function storeSeoPage(key: StoreSeoPageKey): StoreSeoPage {
  // Non-null: the map is built from the same tuple the key type comes from.
  return PAGE_BY_KEY.get(key) as StoreSeoPage;
}

/**
 * Keys that were authorable once and still hold data in `tenants.pageSeo`,
 * mapped to the key that replaced them.
 *
 * `faq` is here rather than deleted because /faq has redirected to /support
 * since app/store/[slug]/faq/page.tsx:4-5 — so the copy an owner wrote for
 * "FAQ" describes exactly the page a visitor now lands on, and dropping the key
 * outright would silently blank metadata that is already live. It is no longer
 * writable (it is not in `STORE_SEO_PAGE_KEYS`, so the route's enum rejects it),
 * and `dropLegacyStorePageSeoKeys` retires the row the first time an owner saves
 * the replacing page.
 */
export const LEGACY_STORE_SEO_PAGE_KEYS: Readonly<
  Record<string, StoreSeoPageKey>
> = { faq: "support" };

export interface StorePageSeo {
  readonly title?: string;
  readonly description?: string;
  readonly ogImage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * One `pageSeo` entry, keeping only the fields that are non-empty strings.
 * `tenants.pageSeo` is a Json column with no DB-level shape, so a nested value
 * can be anything at all; a number title would render `<title>7</title>`.
 */
function entry(value: unknown): StorePageSeo {
  if (!isRecord(value)) return {};

  const title = seoText(value.title);
  const description = seoText(value.description);
  const ogImage = seoText(value.ogImage);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(ogImage ? { ogImage } : {}),
  };
}

function isEmpty(seo: StorePageSeo): boolean {
  return !seo.title && !seo.description && !seo.ogImage;
}

/**
 * The metadata an owner authored for one page — `{}` when there is none.
 *
 * Falls back to a legacy key ONLY when the current key holds nothing at all:
 * whole-entry, never field-by-field, so what renders is always one authored
 * record rather than a blend of two an owner never wrote.
 *
 * Fails closed on every malformed shape (`pageSeo` not an object, an entry that
 * is a string, a title that is a number) because this runs inside
 * `generateMetadata`, where a throw is a blank page rather than a missing tag.
 */
export function readStorePageSeo(
  pageSeo: unknown,
  key: StoreSeoPageKey,
): StorePageSeo {
  if (!isRecord(pageSeo)) return {};

  const current = entry(pageSeo[key]);
  if (!isEmpty(current)) return current;

  for (const [legacyKey, replacedBy] of Object.entries(
    LEGACY_STORE_SEO_PAGE_KEYS,
  )) {
    if (replacedBy !== key) continue;
    const legacy = entry(pageSeo[legacyKey]);
    if (!isEmpty(legacy)) return legacy;
  }

  return {};
}

/**
 * The same blob with the legacy keys that `key` replaced removed.
 *
 * Called on write so the editor and the storefront can never disagree: once an
 * owner saves /support, the old `faq` entry stops being a fallback that would
 * reappear the moment they cleared the new one.
 */
export function dropLegacyStorePageSeoKeys<T>(
  pageSeo: Readonly<Record<string, T>>,
  key: StoreSeoPageKey,
): Record<string, T> {
  const retired = Object.entries(LEGACY_STORE_SEO_PAGE_KEYS)
    .filter(([, replacedBy]) => replacedBy === key)
    .map(([legacyKey]) => legacyKey);

  return Object.fromEntries(
    Object.entries(pageSeo).filter(([entryKey]) => !retired.includes(entryKey)),
  );
}
