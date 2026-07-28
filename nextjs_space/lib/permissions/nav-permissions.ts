import type { PermissionKey } from "./permission-keys";

/**
 * PRD-301 AC-6 — map a tenant-admin nav item id (and its route) to the permission
 * required to see/enter it. `undefined` = always visible to any tenant admin.
 * Used by the sidebar (to hide items) and by page guards (to enforce access).
 */
export const NAV_ITEM_PERMISSIONS: Record<string, PermissionKey | undefined> = {
  overview: undefined,
  products: "canViewProducts",
  orders: "canViewOrders",
  customers: "canViewCustomers",
  analytics: "canViewAnalytics",
  branding: "canManageBranding",
  seo: undefined,
  templates: "canViewTemplates",
  emails: "canViewEmails",
  "the-wire": undefined,
  webhooks: undefined,
  "audit-logs": "canViewAuditLogs",
  team: "canInviteTeamMembers",
  settings: "canEditSettings",
  "cookie-settings": undefined,
  legal: "canEditSettings",
  "legal-documents": "canEditSettings",
  "legal-subprocessors": "canEditSettings",
};
