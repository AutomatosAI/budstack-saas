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
 *  2. A PUBLISHED post's URL can be changed, and doing so is a MOVE: US-019
 *     writes a 301 from the old path as the save lands, so nothing that linked
 *     to the old URL breaks. The editor says this before the save
 *     (`PUBLISHED_SLUG_MOVE_NOTE`) rather than leaving it to be discovered
 *     afterwards. Until US-019 the same field was read-only and the API
 *     answered a rename with 409.
 *  3. "Live" means the SAVED state, not the form's publish toggle — the warning
 *     has to describe the row as it currently stands in the database, which is
 *     what the PATCH route reasons about.
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
 * Would saving this move a URL that is already public?
 *
 * True only when editing a post whose SAVED state is published and whose slug
 * has been changed — see rule 3 above for why the form's own publish toggle is
 * not consulted, and note that a brand-new post created as published is never a
 * move (it has no old URL to leave behind). Drives the warning next to the
 * field; the redirect itself is the server's to write.
 */
export function isPublishedSlugMove(args: {
  isEditing: boolean;
  savedPublished: boolean;
  savedSlug: string;
  slug: string;
}): boolean {
  if (!args.isEditing || !args.savedPublished) return false;
  return args.slug.trim() !== "" && args.slug.trim() !== args.savedSlug;
}

/**
 * The JSON a save sends.
 *
 * `slug` is dropped when the field is empty, which keeps the create route free
 * to derive it from the title — sending `""` would not (the schema requires at
 * least one character when the key is present). A slug that is present and
 * unchanged is sent as-is and costs nothing: the PATCH route compares it with
 * the stored one and only treats a DIFFERENT value as a rename.
 *
 * Trimmed here as well as in the schema so the body that goes over the wire is
 * the body that gets stored — no field arrives padded and comes back different.
 */
export function buildPlatformPostBody(
  values: PlatformPostFormValues,
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
  if (!slug) return body;

  return { ...body, slug };
}
