/**
 * Audit Log Utility
 *
 * Tracks all significant user and system actions for compliance and debugging.
 * Used for GDPR/HIPAA compliance, security auditing, and troubleshooting.
 */

import { prisma } from "@/lib/db";
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
}

/**
 * Create an audit log entry
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
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        userEmail: params.userEmail,
        tenantId: params.tenantId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
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
