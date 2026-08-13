/**
 * Audit Log Utility
 *
 * Tracks all significant user and system actions for compliance and debugging.
 * Used for GDPR/HIPAA compliance, security auditing, and troubleshooting.
 *
 * IMMUTABILITY POLICY: audit_logs rows MUST never be UPDATEd or DELETEd by
 * application code. The schema does not enforce this at the DB level (no
 * trigger), but any code path that mutates an audit row is a compliance bug.
 * Retention is handled out-of-band by an administrator-run cleanup job, NOT
 * by interactive request handlers.
 *
 * PII REDACTION: createAuditLog automatically redacts sensitive fields in
 * the metadata JSON via lib/redact.ts. Callers do not need to pre-sanitize.
 */

import { prisma } from "@/lib/db";
import { sanitizeForLogging } from "@/lib/security/redact";
import { getImpersonationContext } from "@/lib/impersonation/context";
import type { audit_logs } from "@prisma/client";
import crypto from "crypto";

export interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  /**
   * PRD-302: link this row to an impersonation session. Normally OMITTED —
   * rows written inside an impersonated request are stamped automatically from
   * the ambient impersonation context bound by the api-auth wrappers. Pass
   * explicitly only for the session lifecycle events themselves (start/end),
   * which are written from super-admin routes outside that binding.
   */
  impersonationSessionId?: string;
}

/**
 * Create an audit log entry.
 *
 * Sensitive fields in `metadata` are redacted automatically — pass raw values,
 * the lib will strip emails/names/phones/addresses/credentials before write.
 *
 * @example
 * ```ts
 * await createAuditLog({
 *   action: 'product.created',
 *   entityType: 'Product',
 *   entityId: product.id,
 *   userId: session.user.id,
 *   userEmail: session.user.email,
 *   tenantId: tenant.id,
 *   metadata: { productName: product.name, price: product.price },
 *   ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
 *   userAgent: req.headers.get('user-agent') || 'unknown'
 * });
 * ```
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const safeMetadata = params.metadata
      ? sanitizeForLogging(params.metadata)
      : {};

    // PRD-302 AC-5: rows written inside an impersonated request are linked to
    // the session automatically. userId/userEmail already carry the REAL actor
    // (getCurrentUser never fakes identity, only the tenant binding), so the
    // session link is all that's needed to reconstruct "what support did".
    const impersonationSessionId =
      params.impersonationSessionId ??
      getImpersonationContext()?.sessionId ??
      null;

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        userEmail: params.userEmail,
        tenantId: params.tenantId,
        metadata: safeMetadata as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        impersonationSessionId,
      },
    });
  } catch (error) {
    // Don't throw errors for audit log failures to avoid breaking main flow
    console.error("[AuditLog] Failed to create audit log:", error);
  }
}

/**
 * Common audit log actions for easy reference
 */
export const AUDIT_ACTIONS = {
  // Authentication
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_SIGNUP: "user.signup",
  USER_PASSWORD_RESET: "user.password_reset",

  // Tenant Management
  TENANT_CREATED: "tenant.created",
  TENANT_UPDATED: "tenant.updated",
  TENANT_ACTIVATED: "tenant.activated",
  TENANT_DEACTIVATED: "tenant.deactivated",
  TENANT_DELETED: "tenant.deleted",

  // Product Management
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.deleted",
  PRODUCT_STOCK_UPDATED: "product.stock_updated",

  // Order Management
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
  ORDER_STATUS_CHANGED: "order.status_changed",
  ORDER_CANCELLED: "order.cancelled",

  // Consultation Management
  CONSULTATION_SUBMITTED: "consultation.submitted",
  CONSULTATION_STATUS_CHANGED: "consultation.status_changed",

  // Branding
  BRANDING_UPDATED: "branding.updated",
  TEMPLATE_CHANGED: "template.changed",

  // Template Management
  TEMPLATE: {
    CREATED: "template.created",
    UPDATED: "template.updated",
    DELETED: "template.deleted",
  },

  // Webhooks
  WEBHOOK_CREATED: "webhook.created",
  WEBHOOK_UPDATED: "webhook.updated",
  WEBHOOK_DELETED: "webhook.deleted",
  WEBHOOK_TRIGGERED: "webhook.triggered",

  // Settings
  SETTINGS_UPDATED: "settings.updated",

  // GDPR / Customer privacy
  CUSTOMER_UPDATED: "customer.updated",
  CUSTOMER_EMAIL_CHANGED: "customer.email_changed",
  CUSTOMER_KYC_VERIFIED: "customer.kyc_verified",
  // US-023: admin manually records / withdraws a customer's marketing consent
  CUSTOMER_MARKETING_CONSENT_GRANTED: "customer.marketing_consent_granted",
  CUSTOMER_MARKETING_CONSENT_REVOKED: "customer.marketing_consent_revoked",
  CUSTOMER_DELETED_GDPR: "customer.deleted_gdpr",
  ACCOUNT_DATA_EXPORTED: "account.data_exported",
  ACCOUNT_DELETED_GDPR_SELF: "account.deleted_gdpr_self",

  // Team Management (PRD-301)
  TEAM: {
    MEMBER_INVITED: "team.member_invited",
    MEMBER_REMOVED: "team.member_removed",
    INVITATION_ACCEPTED: "team.invitation_accepted",
    INVITATION_RESENT: "team.invitation_resent",
    INVITATION_REVOKED: "team.invitation_revoked",
    ROLE_PERMISSIONS_UPDATED: "team.role_permissions_updated",
    AUDIT_RETENTION_UPDATED: "team.audit_retention_updated",
  },

  // Super-Admin Impersonation (PRD-302)
  IMPERSONATION: {
    STARTED: "super_admin.impersonation_start",
    ENDED: "super_admin.impersonation_end",
  },
} as const;

/**
 * Helper to extract client info from Next.js request
 */
export function getClientInfo(headers: Headers) {
  return {
    ipAddress:
      headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      headers.get("x-real-ip") ||
      "unknown",
    userAgent: headers.get("user-agent") || "unknown",
  };
}

/**
 * Shape consumed by the super-admin Activity Timeline UI. `type` is a coarse
 * theming category (see categorizeAuditAction) and is intentionally a free
 * string — audit `action` values are open-ended, so the UI must tolerate
 * categories it does not explicitly style. The precise action is preserved in
 * `description`.
 */
export interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
  actor?: string;
  metadata?: Record<string, any>;
}

/**
 * Map an open-ended audit `action` to one of the timeline's themed categories.
 * Unknown actions fall through to "ACTIVITY" so the UI renders a neutral chip
 * rather than crashing on an unmapped type.
 */
export function categorizeAuditAction(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("tenant")) {
    if (a.includes("creat")) return "TENANT_CREATED";
    if (a.includes("activat") && !a.includes("deactivat")) return "TENANT_ACTIVATED";
    if (a.includes("delet") || a.includes("deactivat")) return "SYSTEM_ALERT";
    return "TENANT_SETTINGS_UPDATED";
  }
  if (a.includes("order")) return "ORDER_PLACED";
  if (
    a.includes("user") ||
    a.includes("account") ||
    a.includes("signup") ||
    a.includes("register")
  ) {
    return "USER_REGISTERED";
  }
  if (
    a.includes("delet") ||
    a.includes("fail") ||
    a.includes("error") ||
    a.includes("alert") ||
    a.includes("reject")
  ) {
    return "SYSTEM_ALERT";
  }
  return "ACTIVITY";
}

/** "tenant.created" / "TENANT_CREATED" / "product.stock_updated" → "Tenant created". */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Pure mapper from a persisted audit row to the timeline UI shape. */
export function mapAuditLogToTimelineEvent(row: audit_logs): TimelineEvent {
  const entitySuffix = row.entityType ? ` · ${row.entityType}` : "";
  return {
    id: row.id,
    type: categorizeAuditAction(row.action),
    description: `${humanizeAction(row.action)}${entitySuffix}`,
    timestamp: row.createdAt,
    actor: row.userEmail ?? row.userId ?? "System",
    metadata: (row.metadata ?? undefined) as Record<string, any> | undefined,
  };
}

/**
 * Read the most recent audit rows for the super-admin activity overview, plus
 * the total and last-24h counts the stat cards display. Replaces the former
 * generateMockEvents() fabrication (PRD-209 AC-3).
 */
export async function getAuditActivityOverview(limit = 50): Promise<{
  events: TimelineEvent[];
  totalEvents: number;
  last24hCount: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [rows, totalEvents, last24hCount] = await Promise.all([
    prisma.audit_logs.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    prisma.audit_logs.count(),
    prisma.audit_logs.count({ where: { createdAt: { gte: since } } }),
  ]);
  return {
    events: rows.map(mapAuditLogToTimelineEvent),
    totalEvents,
    last24hCount,
  };
}
