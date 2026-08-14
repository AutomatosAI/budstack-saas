/**
 * PRD-301 — the canonical list of granular team permissions.
 *
 * This array is the SINGLE SOURCE OF TRUTH for permission flag names. It must
 * stay in lock-step with the boolean columns on the `role_permissions` Prisma
 * model (prisma/schema.prisma); `schema-guard.ts` enforces that at compile time.
 */
export const PERMISSION_KEYS = [
  "canViewCustomers",
  "canEditCustomers",
  "canExportCustomers",
  "canDeleteCustomer",
  "canViewOrders",
  "canEditOrders",
  "canViewProducts",
  "canEditProducts",
  "canDeleteProducts",
  "canViewAnalytics",
  "canEditSettings",
  "canManageBranding",
  "canInviteTeamMembers",
  "canDeleteTeamMembers",
  "canViewAuditLogs",
  "canViewCRM",
  "canViewEmails",
  "canEditEmails",
  "canViewTemplates",
  "canEditTemplates",
  // SEO Supercharge US-010 — the SEO Manager surface. Split view/edit like
  // emails, because reading a store's metadata and rewriting the title Google
  // shows for it are different acts. NOT added to any non-admin preset's
  // defaults (lib/permissions/preset-roles.ts): PRD-301 AC-2 fixed those five
  // sets before SEO had keys, so a tenant grants these through the roles matrix
  // rather than having them appear under a role they already assigned.
  "canViewSeo",
  "canEditSeo",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** A full, read-only map of every permission flag to a boolean. */
export type PermissionSet = Readonly<Record<PermissionKey, boolean>>;

/**
 * Build a complete, frozen PermissionSet where the given keys are true and every
 * other known permission is false. Always returns all keys — never partial.
 */
export function buildPermissionSet(trueKeys: readonly PermissionKey[]): PermissionSet {
  const set = {} as Record<PermissionKey, boolean>;
  for (const key of PERMISSION_KEYS) set[key] = false;
  for (const key of trueKeys) set[key] = true;
  return Object.freeze(set);
}

/** Every permission denied (fail-closed default). */
export const ALL_FALSE: PermissionSet = buildPermissionSet([]);

/** Every permission granted (super-admin / tenant-owner admin role). */
export const ALL_TRUE: PermissionSet = buildPermissionSet(PERMISSION_KEYS);
