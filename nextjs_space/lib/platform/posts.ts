import { z } from "zod";

import {
  POST_SLUG_HINT,
  POST_SLUG_MAX_LENGTH,
  POST_SLUG_PATTERN,
  slugifyPostTitle,
} from "@/lib/seo/post-slug";

/**
 * US-004 — the write contract for `platform_posts`, shared by the collection
 * route and the item route so the two cannot disagree about what a post is.
 *
 * `platform_posts` is the budstacks.io blog. It is NOT the tenant `posts` table
 * and this is not a copy of the tenant write routes:
 *
 *  - The author is denormalised strings (`authorName` / `authorRole`), so there
 *    is no `users` lookup and no Clerk-id-vs-`users.id` FK class to get wrong
 *    (the P2003 that broke the lekkerweed blog in #226).
 *  - There is no tenant, so no `tenantId` appears in any predicate here.
 *    `platform_posts` is deliberately absent from `tenantScopedModels`
 *    (lib/db.ts) — that Set is an OPT-IN allowlist, and joining it would weld a
 *    tenant filter onto every apex query and empty the blog.
 *  - `coverImageAlt` is a real column, not the `seo.imageAlt` alias the tenant
 *    routes translate into a Json blob.
 *
 * The slug rules come from `lib/seo/post-slug.ts`, the one definition the
 * storefront Wire already uses. Unlike the tenant routes — which apply
 * `normalizePostSlug` and a length cap but leave `POST_SLUG_PATTERN` to the
 * client form — the REGEX IS ENFORCED HERE. That gap is known tenant-side debt,
 * not the example to follow, and a platform post's URL is budstacks.io's own.
 */

/** Length caps: a super-admin session is still a session someone can steal. */
export const PLATFORM_POST_TITLE_MAX = 300;
export const PLATFORM_POST_CONTENT_MAX = 100_000;
export const PLATFORM_POST_EXCERPT_MAX = 5_000;
export const PLATFORM_POST_IMAGE_MAX = 2_000;
export const PLATFORM_POST_IMAGE_ALT_MAX = 300;
export const PLATFORM_POST_AUTHOR_NAME_MAX = 120;
export const PLATFORM_POST_AUTHOR_ROLE_MAX = 120;

/**
 * Body cap. Above `PLATFORM_POST_CONTENT_MAX` characters of HTML with room for
 * the rest of the payload and multi-byte characters; mirrors the tenant post
 * routes' 512 KB so an article that saves on a storefront also saves here.
 */
export const PLATFORM_POST_BODY_MAX_BYTES = 512 * 1024;

/** Refusal wording for a slug that is taken. Names the value so it is fixable. */
export function duplicateSlugMessage(slug: string): string {
  return `The slug "${slug}" is already used by another post. Choose a different one.`;
}

/**
 * Refusal wording for renaming a LIVE post.
 *
 * Changing a published post's slug 404s a URL that is already indexed and
 * already linked to, and discards every inbound link pointing at it. The
 * automatic 301 that makes a rename safe is US-019; until it exists the answer
 * is no, and it is refused HERE rather than only in the editor so an API caller
 * cannot route around the warning the form shows.
 */
export const PUBLISHED_SLUG_LOCKED_MESSAGE =
  "A published post's URL cannot be changed yet — it would break the live link. " +
  "Unpublish it first, or change the slug before publishing.";

const slugSchema = z
  .string()
  .trim()
  .min(1, POST_SLUG_HINT)
  .max(POST_SLUG_MAX_LENGTH, POST_SLUG_HINT)
  .regex(POST_SLUG_PATTERN, POST_SLUG_HINT);

/**
 * Every authored field, all optional. The two exported schemas below narrow
 * this one shape rather than restating it, so create and edit cannot drift.
 *
 * `seo` is `unknown` on purpose: its shape is owned by `readEntitySeo`
 * (lib/seo/entity-seo.ts), which parses fail-closed and drops anything it does
 * not recognise. A second Zod description of the same blob here would be a
 * second definition to keep in step.
 */
const platformPostShape = z.object({
  title: z.string().trim().min(1, "Title is required").max(PLATFORM_POST_TITLE_MAX),
  slug: slugSchema,
  content: z.string().min(1, "Content is required").max(PLATFORM_POST_CONTENT_MAX),
  excerpt: z.string().trim().max(PLATFORM_POST_EXCERPT_MAX),
  coverImage: z.string().trim().max(PLATFORM_POST_IMAGE_MAX),
  coverImageAlt: z.string().trim().max(PLATFORM_POST_IMAGE_ALT_MAX),
  authorName: z
    .string()
    .trim()
    .min(1, "Author name is required")
    .max(PLATFORM_POST_AUTHOR_NAME_MAX),
  authorRole: z.string().trim().max(PLATFORM_POST_AUTHOR_ROLE_MAX),
  published: z.boolean(),
  seo: z.unknown(),
});

/**
 * Create. Title, body and byline are the three things a post cannot exist
 * without; `slug` is derived from the title when it is not supplied, and
 * `published` defaults to false at the call site so a new post is a draft.
 *
 * `.strict()` — an unrecognised key is a caller sending a field this route does
 * not write, and answering 400 says so instead of silently discarding it.
 */
export const platformPostCreateSchema = platformPostShape
  .partial()
  .required({ title: true, content: true, authorName: true })
  .strict();

/** Edit. Every field optional; an absent key means "leave this column alone". */
export const platformPostUpdateSchema = platformPostShape.partial().strict();

export type PlatformPostCreateInput = z.infer<typeof platformPostCreateSchema>;
export type PlatformPostUpdateInput = z.infer<typeof platformPostUpdateSchema>;

/**
 * A `platform_posts` row, declared explicitly.
 *
 * The `prisma` export in lib/db.ts is any-widened (the build-time mock is a
 * Proxy), so an inferred query result makes every downstream callback an
 * implicit `any` and trips TS7006 under `noImplicitAny`.
 */
export interface PlatformPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  authorName: string;
  authorRole: string | null;
  published: boolean;
  publishedAt: Date | null;
  seo: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/** The list projection — everything the admin list shows, minus the article body. */
export type PlatformPostSummary = Omit<PlatformPostRow, "content" | "seo">;

/** Prisma `select` for {@link PlatformPostSummary}; `content` is the big column. */
export const PLATFORM_POST_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  coverImageAlt: true,
  authorName: true,
  authorRole: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * When this save says the post is live, the date the public sees.
 *
 * Stamped ONCE, on the transition into published, and never rewritten: the
 * published date must not jump every time a typo is fixed. Unpublishing keeps
 * the original stamp rather than clearing it, so re-publishing restores the
 * date the article actually appeared instead of inventing a new one.
 */
export function resolvePublishedAt(args: {
  published: boolean;
  existingPublishedAt: Date | null;
  now: Date;
}): Date | null {
  if (!args.published) return args.existingPublishedAt;
  return args.existingPublishedAt ?? args.now;
}

/**
 * The slug a create should use: the authored one, or the title's.
 *
 * Returns null when the title yields nothing usable as a URL segment, and the
 * caller asks for an explicit slug rather than inventing one: truncating a
 * too-long slug, or publishing at `/blog/-`, hands back a URL nobody chose.
 *
 * DERIVATION IS STRICTER THAN VALIDATION, deliberately. `POST_SLUG_PATTERN` has
 * to accept `-` and `_` runs — legacy authored slugs look like that and the
 * editor posts them back unchanged — but a title of punctuation alone
 * slugifies to a bare `"-"`, which passes the pattern and is nobody's URL. An
 * authored slug is still taken exactly as typed; only the derived one has to
 * carry a letter or a digit.
 */
export function resolveCreateSlug(input: {
  slug?: string;
  title: string;
}): string | null {
  if (input.slug) return input.slug;

  const derived = slugifyPostTitle(input.title);
  if (!derived || derived.length > POST_SLUG_MAX_LENGTH) return null;
  if (!/[a-z0-9]/.test(derived)) return null;
  if (!POST_SLUG_PATTERN.test(derived)) return null;

  return derived;
}

/** Shown when a title cannot become a URL and the author must supply one. */
export const UNDERIVABLE_SLUG_MESSAGE =
  "Could not build a URL from this title — enter a slug explicitly. " +
  POST_SLUG_HINT;

/**
 * The one rejection an editor can act on, following the house idiom
 * (app/api/super-admin/subprocessors/route.ts:30). Every message in the schemas
 * above is written for a person, so surfacing the first is more useful than the
 * generic "Invalid request" — and it is our own string, never an exception's.
 */
export function platformPostValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid post.";
}
