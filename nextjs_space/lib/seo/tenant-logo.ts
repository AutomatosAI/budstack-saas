/**
 * SEO Supercharge — the ONE cascade that answers "which image is this store's
 * logo".
 *
 * WHY IT IS SHARED (US-016). The homepage states the store's Organization node
 * and so does every Wire article, because an Article's `publisher` is an `@id`
 * reference and a reference only resolves against a node on the SAME page. Two
 * pages therefore emit the same `@id` — and if they resolved the logo
 * differently, they would be two contradictory statements about one entity,
 * which is exactly the failure a stable `@id` exists to prevent.
 *
 * THE ORDER, and why each step is there:
 *  1. `tenant_branding.logoUrl` — the column the branding form owns.
 *  2. `activeTenantTemplate.logoUrl` — where an uploaded logo actually lands for
 *     a tenant whose template carries one (mirrors US-001's favicon cascade,
 *     app/api/tenant-admin/branding/route.ts:394).
 *  3. `settings.logoPath` — the legacy field the store layout still falls back
 *     to, so a store that has never opened the branding form is not logo-less.
 *
 * Returns a stored REFERENCE (an S3 key or a path), never a URL to fetch:
 * `storedPublicImagePath` inside the builders turns it into the durable
 * `/api/public/images/…` route and returns nothing at all for a presigned URL.
 * Minting one here (`getFileUrl`) would put a link that dies in an hour into
 * structured data that a crawler re-reads for months.
 */

import { parseTenantSettings } from "@/lib/tenant/tenant-settings";

/**
 * The parts of a `getTenantWithTemplate` row this reads.
 *
 * Every field is optional and loosely typed because the `prisma` export in
 * lib/db.ts is any-widened by its build-time mock Proxy — nothing flows out of
 * the query, so the shape is asserted here rather than inferred.
 */
export interface TenantLogoRow {
  readonly id: string;
  /** Raw `tenants.settings` Json — parsed fail-closed, never cast. */
  readonly settings: unknown;
  readonly tenant_branding?: { logoUrl?: string | null } | null;
  readonly activeTenantTemplate?: { logoUrl?: string | null } | null;
}

/** The stored logo reference for a tenant, or null when it has none. */
export function tenantLogoRef(row: TenantLogoRow): string | null {
  return (
    row.tenant_branding?.logoUrl ??
    row.activeTenantTemplate?.logoUrl ??
    parseTenantSettings(row.settings, { tenantId: row.id }).logoPath ??
    null
  );
}
