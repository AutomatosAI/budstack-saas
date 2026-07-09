import {
  ALL_TRUE,
  buildPermissionSet,
  type PermissionKey,
  type PermissionSet,
} from "./permission-keys";

/**
 * PRD-301 — the 5 preset team roles. v1 does NOT allow custom role creation;
 * admins may customise the permission matrix of these presets (except `admin`,
 * which is always all-true and locked).
 */
export const TEAM_ROLES = [
  "admin",
  "editor",
  "customer_support",
  "web_designer",
  "manager",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/** The always-all-permissions role. Not editable in the matrix UI. */
export const ADMIN_TEAM_ROLE: TeamRole = "admin";

/** Type guard: is an arbitrary string one of the 5 preset roles? */
export function isTeamRole(value: string | null | undefined): value is TeamRole {
  return typeof value === "string" && (TEAM_ROLES as readonly string[]).includes(value);
}

/**
 * Default TRUE permissions per non-admin preset, derived from PRD-301 AC-2
 * ("Default Permission Sets"). `admin` is handled separately (all true).
 *
 * NOTE: AC-2's textual defaults (authoritative for *seeding*) differ slightly
 * from AC-4's illustrative table; we follow AC-2 here.
 */
const DEFAULT_TRUE_KEYS: Record<Exclude<TeamRole, "admin">, readonly PermissionKey[]> = {
  // Editor: view/edit products & templates, view orders, CRM.
  editor: [
    "canViewProducts",
    "canEditProducts",
    "canViewTemplates",
    "canEditTemplates",
    "canViewOrders",
    "canViewCRM",
  ],
  // Customer Support: view/export/delete (GDPR) customers, view orders, CRM.
  customer_support: [
    "canViewCustomers",
    "canExportCustomers",
    "canDeleteCustomer",
    "canViewOrders",
    "canViewCRM",
  ],
  // Web Designer: edit templates & branding, view products (read-only).
  web_designer: [
    "canViewTemplates",
    "canEditTemplates",
    "canManageBranding",
    "canViewProducts",
  ],
  // Manager: view analytics, orders, customers (read-only), manage emails.
  manager: [
    "canViewAnalytics",
    "canViewOrders",
    "canViewCustomers",
    "canViewEmails",
    "canEditEmails",
  ],
};

/** The seeded default permission matrix for a brand-new tenant. */
export const DEFAULT_PERMISSIONS: Readonly<Record<TeamRole, PermissionSet>> = Object.freeze({
  admin: ALL_TRUE,
  editor: buildPermissionSet(DEFAULT_TRUE_KEYS.editor),
  customer_support: buildPermissionSet(DEFAULT_TRUE_KEYS.customer_support),
  web_designer: buildPermissionSet(DEFAULT_TRUE_KEYS.web_designer),
  manager: buildPermissionSet(DEFAULT_TRUE_KEYS.manager),
});
