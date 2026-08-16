import { resolveCreateSlug } from "./posts";

/**
 * US-007 — the pure half of the super-admin post editor.
 *
 * Split out of `app/super-admin/the-wire/post-form.tsx` for the same reason
 * `wire-paths.ts` was split out of `post-metadata.ts`: the form is a client
 * component, and the three decisions below are the ones worth asserting
 * without a browser. Nothing here may import Prisma, pino or `next/server`.
 *
 * The rules it encodes:
 *
 *  1. A new post's URL comes from its title, using the SAME derivation the POST
 *     route applies when no slug is sent (`resolveCreateSlug`) — so what the
 *     author sees in the field is what the server would have chosen anyway.
 *  2. A PUBLISHED post's URL is locked. Changing it 404s a live link and
 *     discards everything pointing at it; the automatic 301 that makes a rename
 *     safe is US-019. The API refuses it too (409, `PUBLISHED_SLUG_LOCKED_MESSAGE`)
 *     — this is the half that explains it before the save rather than after.
 *  3. The lock keys off the SAVED state, not the form's publish toggle. The
 *     PATCH route compares against the row in the database, so unpublishing and
 *     renaming in one save would still be refused; the URL becomes editable
 *     after the unpublish is saved, and the copy in the form says so.
 */

/** Every field the editor writes. All strings, so the form has no undefined. */
export interface PlatformPostFormValues {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  coverImageAlt: string;
  authorName: string;
  authorRole: string;
  published: boolean;
}

/**
 * The request body the write routes accept, as this form sends it.
 *
 * `slug` is the only optional key: it is omitted when there is nothing to send
 * (see {@link buildPlatformPostBody}), and an absent key means "leave the
 * column alone" to the PATCH route and "derive it from the title" to the POST
 * route. Every other field is always present, because the form always has one.
 */
export interface PlatformPostRequestBody
  extends Omit<PlatformPostFormValues, "slug"> {
  slug?: string;
}

/**
 * The byline a new post starts with — the one the two editorial posts already
 * published under (seeded by 20260816000000_seed_editorial_platform_posts;
 * `lib/blog/posts.ts` was their home until US-012 deleted it). The signed-in
 * super-admin's own name is deliberately NOT the default:
 * `platform_posts.authorName` is printed on a public page, and putting a
 * person's name there because they happened to be logged in is a surprising
 * thing to do on their behalf. It stays editable.
 */
export const DEFAULT_PLATFORM_AUTHOR_NAME = "BudStacks";
export const DEFAULT_PLATFORM_AUTHOR_ROLE = "Platform Team";

/**
 * The URL a title implies, or `""` when the title yields nothing usable.
 *
 * Empty rather than a guess: `resolveCreateSlug` refuses a title that
 * slugifies to punctuation alone or overruns the column, and the field is left
 * blank so the author supplies one instead of publishing at `/blog/-`.
 */
export function deriveDraftSlug(title: string): string {
  return resolveCreateSlug({ title }) ?? "";
}

/**
 * Is this post's URL frozen? True only when editing a post that is ALREADY
 * live — see rule 3 above for why the form's own publish toggle is not
 * consulted, and why a brand-new post created as published is not locked (it
 * has no old URL to break).
 */
export function isPublishedSlugLocked(args: {
  isEditing: boolean;
  savedPublished: boolean;
}): boolean {
  return args.isEditing && args.savedPublished;
}

/**
 * The JSON a save sends.
 *
 * `slug` is dropped when the post is locked or the field is empty. Dropping it
 * on a locked post means a routine save — fixing a typo in the body of a live
 * article — never presents a slug at all, so it cannot trip the rename refusal
 * on its way through; dropping an empty one keeps the create route free to
 * derive it, which sending `""` would not (the schema requires at least one
 * character when the key is present).
 *
 * Trimmed here as well as in the schema so the body that goes over the wire is
 * the body that gets stored — no field arrives padded and comes back different.
 */
export function buildPlatformPostBody(
  values: PlatformPostFormValues,
  opts: { slugLocked: boolean },
): PlatformPostRequestBody {
  const body: PlatformPostRequestBody = {
    title: values.title.trim(),
    content: values.content,
    excerpt: values.excerpt.trim(),
    coverImage: values.coverImage.trim(),
    coverImageAlt: values.coverImageAlt.trim(),
    authorName: values.authorName.trim(),
    authorRole: values.authorRole.trim(),
    published: values.published,
  };

  const slug = values.slug.trim();
  if (opts.slugLocked || !slug) return body;

  return { ...body, slug };
}
