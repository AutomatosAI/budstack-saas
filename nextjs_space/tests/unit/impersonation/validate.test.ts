import { describe, it, expect } from "vitest";
import {
  rejectSessionRow,
  type SessionRowForValidation,
} from "@/lib/impersonation/validate";

const NOW = new Date("2026-07-10T12:00:00.000Z");
const LATER = new Date("2026-07-10T16:00:00.000Z");
const EARLIER = new Date("2026-07-10T08:00:00.000Z");

function row(over: Partial<SessionRowForValidation> = {}): SessionRowForValidation {
  return {
    superAdminClerkId: "clerk_admin",
    endedAt: null,
    expiresAt: LATER,
    tenant: { isActive: true, deletedAt: null },
    ...over,
  };
}

describe("rejectSessionRow (PRD-302 AC-7, fail-closed)", () => {
  it("accepts a live, owned session against an active tenant", () => {
    expect(rejectSessionRow(row(), "clerk_admin", NOW)).toBeNull();
  });

  it("rejects an ended session", () => {
    expect(
      rejectSessionRow(row({ endedAt: EARLIER }), "clerk_admin", NOW),
    ).toBe("ended");
  });

  it("rejects a cookie presented by a DIFFERENT Clerk user (never adopt)", () => {
    expect(rejectSessionRow(row(), "clerk_other", NOW)).toBe("not_owner");
  });

  it("rejects an expired session", () => {
    expect(
      rejectSessionRow(row({ expiresAt: EARLIER }), "clerk_admin", NOW),
    ).toBe("expired");
  });

  it("rejects exactly-at-expiry (boundary is exclusive)", () => {
    expect(
      rejectSessionRow(row({ expiresAt: NOW }), "clerk_admin", NOW),
    ).toBe("expired");
  });

  it("rejects when the tenant is missing, inactive, or soft-deleted", () => {
    expect(rejectSessionRow(row({ tenant: null }), "clerk_admin", NOW)).toBe(
      "tenant_unavailable",
    );
    expect(
      rejectSessionRow(
        row({ tenant: { isActive: false, deletedAt: null } }),
        "clerk_admin",
        NOW,
      ),
    ).toBe("tenant_unavailable");
    expect(
      rejectSessionRow(
        row({ tenant: { isActive: true, deletedAt: EARLIER } }),
        "clerk_admin",
        NOW,
      ),
    ).toBe("tenant_unavailable");
  });

  it("checks ownership before expiry — a foreign expired cookie reads as not_owner", () => {
    expect(
      rejectSessionRow(row({ expiresAt: EARLIER }), "clerk_other", NOW),
    ).toBe("not_owner");
  });
});
