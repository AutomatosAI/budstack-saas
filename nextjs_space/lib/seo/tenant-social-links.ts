/**
 * LLM Visibility US-006 — the ONE place a tenant row becomes a `sameAs` list.
 *
 * WHY IT IS SHARED, and why it is a module of its own rather than a line in each
 * page: the homepage states the store's Organization node and so does every Wire
 * article, under the SAME `@id` (see `buildOrganizationNode`). If the two pages
 * resolved the profile list differently — one reading the settings blob, one
 * passing [] because its author forgot — they would be two contradictory
 * statements about one entity, which is exactly the failure a stable `@id`
 * exists to prevent. `lib/seo/tenant-logo.ts` exists for the same reason and
 * says the same thing about the logo.
 *
 * It lives here rather than in `lib/seo/social-links.ts` because it needs
 * `parseTenantSettings`, and that module cannot: the validation schema imports
 * the size caps from it, so importing the parser there would close a cycle.
 * This module is the seam where the pure rules and the sanctioned settings
 * reader meet.
 */

import { readSocialLinks } from "@/lib/seo/social-links";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";

/**
 * The parts of a `getTenantWithTemplate` row this reads.
 *
 * Loosely typed for the same reason `TenantLogoRow` is: the `prisma` export in
 * lib/db.ts is any-widened by its build-time mock Proxy, so nothing flows out of
 * the query and the shape is asserted here rather than inferred.
 */
export interface TenantSocialLinksRow {
  readonly id: string;
  /** Raw `tenants.settings` Json — parsed fail-closed, never cast. */
  readonly settings: unknown;
}

/** The profiles this store publishes as its own, or an empty list. */
export function tenantSocialLinks(
  row: TenantSocialLinksRow,
): readonly string[] {
  return readSocialLinks(parseTenantSettings(row.settings, { tenantId: row.id }));
}
