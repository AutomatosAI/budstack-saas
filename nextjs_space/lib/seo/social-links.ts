/**
 * LLM Visibility US-006 — the store's profiles elsewhere, as `sameAs`.
 *
 * WHAT THIS IS FOR. A store's Organization node says "this entity is called X
 * and lives at this URL". Nothing in it connects that entity to the Instagram
 * account, the LinkedIn page or the Companies House record describing the same
 * business, so a knowledge graph has no evidence the four are one thing.
 * `sameAs` is the property that supplies it: a list of URLs the publisher
 * asserts are the SAME entity as the node they hang off.
 *
 * WHAT IT IS NOT. It is a statement of identity, not a ranking lever, and the
 * card in the SEO Manager says so. Listing a profile does not make an engine
 * cite the store; it lets an engine that has already found both work out they
 * are one business rather than two.
 *
 * https ONLY, and that is not fussiness. These URLs are published as the
 * store's own assertion about who it is. An http profile link on a store served
 * over https either points at something the owner does not control any more or
 * downgrades the reader on the way to it, and a consumer that follows sameAs to
 * a redirect chain reads the destination, not the value we wrote. Same rule,
 * same reasoning as `isCanonicalOverrideUrl` in lib/seo/entity-seo.ts.
 *
 * TWO CHECKS, TWO PLACES — the split `lib/seo/site-verification.ts` documents:
 *  - `lib/validation/tenant-settings.ts` bounds the SIZE of the stored key (how
 *    many entries, how long each). It does NOT check the scheme, because that
 *    schema is what `parseTenantSettings` runs on every storefront read and it
 *    fails as a UNIT: one http entry that reached the column by hand would
 *    return `{}` and take the tenant's tagline, colours and cookie banner with
 *    it. Size is safe to pin there because the write route below is the only
 *    writer and cannot produce a violation of it.
 *  - HERE, the scheme is enforced on the way IN by the route and re-applied on
 *    the way OUT by {@link readSocialLinks}, so a value that arrived some other
 *    way is dropped from the render rather than published.
 *
 * Pure module — no prisma, no next, no `parseTenantSettings` (importing that
 * would close a cycle: it depends on the validation module that depends on this
 * one for its bounds; `lib/seo/tenant-social-links.ts` is where the two meet).
 * It runs inside the store's render path, which has no `error.tsx` boundary
 * above it, so every path degrades to "publish nothing" rather than throwing.
 */

/**
 * How many profiles one store may publish.
 *
 * Eight because `sameAs` is a claim of control, not a directory: the accounts a
 * store actually runs are the handful a reader would recognise, and a list long
 * enough to include every aggregator that ever mentioned the business is a
 * weaker statement than a short one, not a stronger.
 */
export const SOCIAL_LINKS_MAX = 8;

/** How long one profile URL may be. Longer than this is not a profile URL. */
export const SOCIAL_LINK_MAX_LENGTH = 300;

/** Shown verbatim to the owner by both the card and the route. */
export const SOCIAL_LINKS_TOO_MANY_MESSAGE = `List up to ${SOCIAL_LINKS_MAX} profiles. Keep the accounts you actually run — a longer list is a weaker claim, not a stronger one.`;

/** Shown verbatim when an entry is not a full https address. */
export const SOCIAL_LINKS_INVALID_MESSAGE =
  "Each line must be a full https:// address for a profile you control, like https://www.instagram.com/yourstore.";

/** How much of an offending entry is echoed back in the rejection. */
const REJECTED_VALUE_PREVIEW_LENGTH = 80;

/**
 * Is this a profile URL we are willing to publish as the store's own identity?
 *
 * Absolute, https, and with a host — the same three conditions
 * `isCanonicalOverrideUrl` applies, under its own length cap. Shared by the Zod
 * refinement on the write route and by {@link normalizeSocialLinks}, so a value
 * that was legal when it was written stays legal when it is read.
 */
export function isSocialProfileUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > SOCIAL_LINK_MAX_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * The publishable list from any input at all.
 *
 * Total and fail-closed: a value that is not an array, an entry that is not an
 * https URL, a duplicate, and everything past the cap are all dropped rather
 * than published or thrown over. Runs on the read path AND inside the JSON-LD
 * builder, so a caller that assembles the list some other way still cannot put
 * an unchecked string into a `sameAs`.
 *
 * Duplicates go because `sameAs` is a set: stating one profile twice is not a
 * stronger claim, and it costs an entry against the cap.
 */
export function normalizeSocialLinks(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const links: string[] = [];

  for (const entry of raw) {
    if (links.length >= SOCIAL_LINKS_MAX) break;
    const value = typeof entry === "string" ? entry.trim() : entry;
    if (!isSocialProfileUrl(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    links.push(value);
  }

  return links;
}

/** The `tenants.settings` key this module reads. Optional, like every other. */
export interface SocialLinksSettings {
  readonly socialLinks?: readonly unknown[] | null;
}

/**
 * The store's published profiles, read back off a parsed settings blob with the
 * scheme rule re-applied — the "on the way out" half of the two-place check in
 * the module docstring.
 */
export function readSocialLinks(
  settings: SocialLinksSettings | null | undefined,
): readonly string[] {
  return normalizeSocialLinks(settings?.socialLinks);
}

/**
 * The list to STORE for one save, or the rejection to show the owner.
 *
 * Unlike {@link normalizeSocialLinks} this REFUSES rather than filters: dropping
 * a bad line silently would let an owner save, see a shorter list come back and
 * have to work out which line went missing and why. The route and the card both
 * run it, so the message an owner reads is the same either way.
 *
 * An empty list is valid — it is how an owner removes every profile they had.
 */
export function checkSocialLinks(
  raw: unknown,
): { ok: true; value: readonly string[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: SOCIAL_LINKS_INVALID_MESSAGE };
  }
  if (raw.length > SOCIAL_LINKS_MAX) {
    return { ok: false, message: SOCIAL_LINKS_TOO_MANY_MESSAGE };
  }

  const seen = new Set<string>();
  const links: string[] = [];

  for (const entry of raw) {
    const value = typeof entry === "string" ? entry.trim() : entry;
    if (!isSocialProfileUrl(value)) {
      return {
        ok: false,
        message: `${SOCIAL_LINKS_INVALID_MESSAGE} This one is not: ${rejectedPreview(entry)}`,
      };
    }
    // A repeated line is normalised away rather than refused: it is a paste
    // slip, not a mistake an owner needs explaining to them.
    if (seen.has(value)) continue;
    seen.add(value);
    links.push(value);
  }

  return { ok: true, value: links };
}

/** As much of a refused entry as is useful to quote back, and no more. */
function rejectedPreview(entry: unknown): string {
  const text = typeof entry === "string" ? entry.trim() : String(entry);
  return text.length > REJECTED_VALUE_PREVIEW_LENGTH
    ? `${text.slice(0, REJECTED_VALUE_PREVIEW_LENGTH)}…`
    : text;
}
