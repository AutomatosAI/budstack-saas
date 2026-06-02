import { describe, it, expect } from "vitest";
import {
  categorizeAuditAction,
  mapAuditLogToTimelineEvent,
} from "@/lib/audit-log";

function row(overrides: Record<string, any> = {}) {
  return {
    id: "a1",
    action: "tenant.created",
    entityType: "Tenant",
    entityId: "t1",
    userId: "u1",
    userEmail: "admin@example.com",
    tenantId: "t1",
    metadata: null,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date("2026-06-01T12:00:00Z"),
    ...overrides,
  };
}

describe("categorizeAuditAction", () => {
  it("maps tenant lifecycle actions in both dot and upper-case forms", () => {
    expect(categorizeAuditAction("tenant.created")).toBe("TENANT_CREATED");
    expect(categorizeAuditAction("TENANT_CREATED")).toBe("TENANT_CREATED");
    expect(categorizeAuditAction("tenant.activated")).toBe("TENANT_ACTIVATED");
    expect(categorizeAuditAction("tenant.updated")).toBe("TENANT_SETTINGS_UPDATED");
    expect(categorizeAuditAction("tenant.deleted")).toBe("SYSTEM_ALERT");
    expect(categorizeAuditAction("tenant.deactivated")).toBe("SYSTEM_ALERT");
  });

  it("maps order and user actions", () => {
    expect(categorizeAuditAction("order.created")).toBe("ORDER_PLACED");
    expect(categorizeAuditAction("user.signup")).toBe("USER_REGISTERED");
  });

  it("falls back to ACTIVITY for unmapped actions so the UI never crashes", () => {
    expect(categorizeAuditAction("product.created")).toBe("ACTIVITY");
    expect(categorizeAuditAction("something.totally.new")).toBe("ACTIVITY");
  });
});

describe("mapAuditLogToTimelineEvent", () => {
  it("maps a row to the timeline shape with a humanized description", () => {
    const e = mapAuditLogToTimelineEvent(row() as any);
    expect(e.id).toBe("a1");
    expect(e.type).toBe("TENANT_CREATED");
    expect(e.description).toBe("Tenant created · Tenant");
    expect(e.timestamp).toEqual(new Date("2026-06-01T12:00:00Z"));
    expect(e.actor).toBe("admin@example.com");
  });

  it("falls back actor to userId, then to System", () => {
    expect(mapAuditLogToTimelineEvent(row({ userEmail: null }) as any).actor).toBe("u1");
    expect(
      mapAuditLogToTimelineEvent(row({ userEmail: null, userId: null }) as any).actor,
    ).toBe("System");
  });

  it("passes metadata through, undefined when null", () => {
    expect(mapAuditLogToTimelineEvent(row({ metadata: null }) as any).metadata).toBeUndefined();
    expect(
      mapAuditLogToTimelineEvent(row({ metadata: { a: 1 } }) as any).metadata,
    ).toEqual({ a: 1 });
  });
});
