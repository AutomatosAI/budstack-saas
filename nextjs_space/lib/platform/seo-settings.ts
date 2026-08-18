import { z } from "zod";

import { isPlatformSeoRoutePath } from "./seo-routes";

/**
 * US-014 — the write contract for `platform_seo_settings`, budstacks.io's own
 * per-route metadata.
 *
 * WHY THIS IS FLAT AND NOT `EntitySeo`. The tenant SEO routes write a Json blob
 * (`lib/seo/entity-seo.ts`) because a store's metadata rides on a column of the
 * entity it describes. `platform_seo_settings` has REAL COLUMNS — title,
 * description, ogImage, noindex — so the body mirrors those and nothing else. A
 * key with no column behind it would be a field the editor can write and no page
 * can read, which is the defect the SEO workstream exists to close; `.strict()`
 * is what refuses one.
 *
 * That is also why `robots.nofollow`, `canonicalOverride` and `sitemapExclude`
 * are absent: the platform stores none of them, so the editor is told not to
 * offer them (`indexingFields` on `SeoEditorModal`) rather than collecting them
 * into a request this schema would reject.
 *
 * WHOLE-RECORD SEMANTICS. A PUT replaces every authored field on the row: the
 * editor holds the complete record and always sends all four, so an omitted key
 * means "cleared", not "unchanged". No partial-merge rule is needed, and none is
 * implied — unlike the tenant routes, where a Basic tenant's save deliberately
 * preserves indexing rules it is not allowed to send.
 */

/** Length caps: a super-admin session is still a session someone can steal. */
export const PLATFORM_SEO_TITLE_MAX = 300;
export const PLATFORM_SEO_DESCRIPTION_MAX = 1_000;
export const PLATFORM_SEO_OG_IMAGE_MAX = 2_000;

/** Body cap. Four short fields; anything near this is not a settings save. */
export const PLATFORM_SEO_BODY_MAX_BYTES = 16 * 1024;

export const UNKNOWN_ROUTE_MESSAGE =
  "That is not a route budstacks.io publishes. Pick one from the list.";

/**
 * What an og:image reference may be, matching `platformAbsoluteUrl`'s contract
 * exactly (lib/seo/platform-url.ts): a rooted path on this origin, or an
 * absolute http(s) URL. Anything else — a protocol-relative `//host/x`, a bare
 * `image.png` — is dropped by that resolver, so storing one would put a value in
 * the table that no rendered tag ever carries.
 */
export const OG_IMAGE_REFERENCE_MESSAGE =
  "The social image must be a path on this site (starting with /) or a full https:// URL.";

function isOgImageReference(value: string): boolean {
  if (/^https?:\/\//i.test(value)) return true;
  return value.startsWith("/") && !value.startsWith("//");
}

/** An authored text field: trimmed, capped, and optional. */
const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).optional();

export const platformSeoSettingSchema = z
  .object({
    routePath: z
      .string()
      .trim()
      .min(1, UNKNOWN_ROUTE_MESSAGE)
      .refine(isPlatformSeoRoutePath, UNKNOWN_ROUTE_MESSAGE),
    title: optionalText(
      PLATFORM_SEO_TITLE_MAX,
      `The title must be ${PLATFORM_SEO_TITLE_MAX} characters or fewer.`,
    ),
    description: optionalText(
      PLATFORM_SEO_DESCRIPTION_MAX,
      `The description must be ${PLATFORM_SEO_DESCRIPTION_MAX} characters or fewer.`,
    ),
    ogImage: optionalText(
      PLATFORM_SEO_OG_IMAGE_MAX,
      `The social image reference must be ${PLATFORM_SEO_OG_IMAGE_MAX} characters or fewer.`,
    )
      // Empty passes: clearing the field is how a route goes back to the
      // fallback, and it must not be refused as a malformed URL.
      .refine(
        (value) => !value || isOgImageReference(value),
        OG_IMAGE_REFERENCE_MESSAGE,
      ),
    noindex: z.boolean().optional(),
  })
  .strict();

export type PlatformSeoSettingInput = z.infer<typeof platformSeoSettingSchema>;

/**
 * The one rejection an editor can act on, following the house idiom
 * (lib/platform/posts.ts, app/api/super-admin/subprocessors/route.ts). Every
 * message above is written for a person, and it is our own string, never an
 * exception's.
 */
export function platformSeoValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid SEO settings.";
}

/**
 * The columns both the admin page and the write route read back.
 *
 * `createdAt`/`updatedAt` are omitted: nothing renders them, and leaving them
 * out means this row crosses the server-to-client boundary as plain JSON with no
 * Date in it.
 */
export const PLATFORM_SEO_SETTING_SELECT = {
  id: true,
  routePath: true,
  title: true,
  description: true,
  ogImage: true,
  noindex: true,
} as const;

/**
 * One settings row. Stated explicitly because the `prisma` export is
 * any-widened — an inferred result makes every map callback over these rows an
 * implicit `any` (TS7006).
 */
export interface PlatformSeoSettingRow {
  readonly id: string;
  readonly routePath: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly ogImage: string | null;
  readonly noindex: boolean;
}

/**
 * What to store for an authored text field.
 *
 * "" becomes NULL, never an empty string: US-015 reads these columns as
 * overrides and falls back per column, and a stored "" would override a real
 * title with nothing at all.
 */
export function storedSeoText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
