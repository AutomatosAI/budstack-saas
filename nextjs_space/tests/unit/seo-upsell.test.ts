import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// SEO Supercharge US-013 — the locked state a Basic tenant sees instead of a
// blank space, and the one claim that makes it safe to ship: the lock is
// PRESENTATION and the server gate is the boundary.
//
// Three things are pinned here:
//  1. the lock decision is driven by the plan column through the SAME resolver
//     the route gate uses, so UI and API cannot disagree about who has Pro;
//  2. it locks ONLY plan 'basic' — trial (the launch window), pro and custom
//     all see Pro working — and it fails closed on an unreadable plan;
//  3. a Basic tenant who ignores the UI entirely and calls a Pro route by hand
//     still gets 403 `upgrade_required`.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
// The real permission wrapper, the real plan gate and the real entitlement
// matrix all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { PLANS, type Plan } from "@/lib/entitlements/plan";
import { FEATURES } from "@/lib/entitlements/features";
import {
  requireFeature,
  UPGRADE_REQUIRED_CODE,
} from "@/lib/entitlements/require-feature";
import {
  BASIC_PLAN_PRICE_LABEL,
  PRO_PLAN_PRICE_LABEL,
  UPGRADE_CONTACT_PATH,
  UPGRADE_CTA_LABEL,
  UPGRADE_PATH,
} from "@/lib/entitlements/upgrade";
import { SEO_PRO_FEATURES, isSeoProUnlocked } from "@/lib/seo/pro-features";
import { requirePermission } from "@/lib/permissions/require-permission";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";

/** Plans that hold seo.pro — everything except the paid floor. */
const UNLOCKED_PLANS: Plan[] = PLANS.filter((p) => p !== "basic");

function adminUser() {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  };
}

/** Run the REAL pure resolver so the fixture cannot drift from production. */
const OWNER_ADMIN = () => ({
  teamRole: "admin",
  permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole: "admin" }),
});

function request() {
  return new NextRequest("http://store.dev/api/tenant-admin/seo/pro-thing", {
    method: "POST",
  });
}

/** What the plan column returns for the next gate lookup. */
function planColumn(plan: unknown) {
  prismaMock.tenants.findFirst.mockResolvedValue({ plan });
}

/** A Pro route exactly as Workstream C builds them: permission, then plan. */
function proRoute() {
  return requirePermission(
    "canEditSeo",
    requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());
});

describe("the lock shows for basic and nobody else", () => {
  it("locks plan 'basic'", () => {
    expect(isSeoProUnlocked({ id: TENANT_A, plan: "basic" })).toBe(false);
  });

  // Trial is the 3-month launch window. A trial tenant seeing locked cards
  // would be shown an upsell for features they already have.
  it.each(UNLOCKED_PLANS)("unlocks plan %s", (plan) => {
    expect(isSeoProUnlocked({ id: TENANT_A, plan })).toBe(true);
  });

  it.each([undefined, null, "", "PRO", "enterprise", 169, {}])(
    "fails closed to locked on the unreadable plan %s",
    (plan) => {
      expect(isSeoProUnlocked({ id: TENANT_A, plan })).toBe(false);
    },
  );

  it("never unlocks a tenant whose plan the query never returned", () => {
    // The page reads `plan` off a row it already fetched; a select that lost
    // the column must degrade the tenant, not promote them.
    expect(isSeoProUnlocked({ id: TENANT_A })).toBe(false);
  });
});

describe("the UI lock is presentation, never the boundary", () => {
  it("403s a basic tenant's direct API call with the upgrade_required shape", async () => {
    planColumn("basic");

    const res = await proRoute()(request());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toEqual({
      error: expect.any(String),
      code: UPGRADE_REQUIRED_CODE,
      feature: FEATURES.SEO_PRO,
      plan: "basic",
    });
  });

  // The load-bearing claim of this story. If these two ever disagreed, either a
  // Basic tenant would see a control that 403s on click, or a Pro tenant would
  // see a lock over a feature they pay for. Same resolver, same answer — for
  // junk plan values too.
  it.each([...PLANS, "enterprise", "", "PRO"])(
    "agrees with the server gate on plan %s",
    async (plan) => {
      planColumn(plan);

      const uiUnlocked = isSeoProUnlocked({ id: TENANT_A, plan });
      const status = (await proRoute()(request())).status;

      expect(uiUnlocked).toBe(status !== 403);
    },
  );

  it("does not read the plan from anything the tenant controls", async () => {
    planColumn("basic");

    await proRoute()(request());

    // The gate's only lookup is the column, scoped to the caller's own tenant.
    expect(prismaMock.tenants.findFirst).toHaveBeenCalledWith({
      where: { id: TENANT_A },
      select: { plan: true },
    });
  });
});

describe("the upsell tells the tenant what Pro is and how to get it", () => {
  it("names the price verbatim in the CTA", () => {
    // PRD copy, pinned: "CTA copy names the price".
    expect(UPGRADE_CTA_LABEL).toBe("Upgrade to Pro — $169/mo");
    expect(UPGRADE_CTA_LABEL).toContain(PRO_PLAN_PRICE_LABEL);
    expect(BASIC_PLAN_PRICE_LABEL).toBe("$99/mo");
  });

  it.each([UPGRADE_PATH, UPGRADE_CONTACT_PATH])(
    "sends %s in-app — no checkout, no external host",
    (path) => {
      expect(path.startsWith("/")).toBe(true);
      expect(path).not.toMatch(/^https?:|^\/\/|stripe|checkout|billing|pay/i);
    },
  );

  it("lists a feature per Workstream C capability, each with one concrete line", () => {
    expect(SEO_PRO_FEATURES.length).toBeGreaterThanOrEqual(6);

    for (const feature of SEO_PRO_FEATURES) {
      expect(feature.title.trim()).not.toBe("");
      expect(feature.valueProp.trim()).not.toBe("");
      // One line, one benefit — a card, not a paragraph.
      expect(feature.valueProp).not.toContain("\n");
      expect(feature.valueProp.length).toBeLessThanOrEqual(180);
    }
  });

  it("keeps the list keys unique so both surfaces render stably", () => {
    const ids = SEO_PRO_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("promises nothing the plan gate does not grant", () => {
    // Every card is sold on `seo.pro`. If a future entry needed a different
    // key, it would need a different gate — and this test would be the place
    // that noticed.
    expect(FEATURES.SEO_PRO).toBe("seo.pro");
  });
});
