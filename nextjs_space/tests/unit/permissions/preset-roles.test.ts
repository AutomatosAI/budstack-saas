import { describe, it, expect } from "vitest";
import { PERMISSION_KEYS } from "@/lib/permissions/permission-keys";
import {
  TEAM_ROLES,
  DEFAULT_PERMISSIONS,
  isTeamRole,
  type TeamRole,
} from "@/lib/permissions/preset-roles";

describe("preset team roles", () => {
  it("defines exactly the 5 PRD-301 preset roles, in order", () => {
    expect([...TEAM_ROLES]).toEqual([
      "admin",
      "editor",
      "customer_support",
      "web_designer",
      "manager",
    ]);
  });

  it("recognises valid roles and rejects everything else", () => {
    for (const role of TEAM_ROLES) expect(isTeamRole(role)).toBe(true);
    expect(isTeamRole("owner")).toBe(false);
    expect(isTeamRole("ADMIN")).toBe(false); // case-sensitive
    expect(isTeamRole("")).toBe(false);
    expect(isTeamRole(null)).toBe(false);
    expect(isTeamRole(undefined)).toBe(false);
  });

  it("every default set is complete — all permission keys present as booleans", () => {
    for (const role of TEAM_ROLES) {
      const set = DEFAULT_PERMISSIONS[role];
      expect(Object.keys(set).sort()).toEqual([...PERMISSION_KEYS].sort());
      for (const key of PERMISSION_KEYS) expect(typeof set[key]).toBe("boolean");
    }
  });

  it("admin has every permission", () => {
    for (const key of PERMISSION_KEYS) expect(DEFAULT_PERMISSIONS.admin[key]).toBe(true);
  });

  const trueKeysOf = (role: TeamRole) =>
    PERMISSION_KEYS.filter((k) => DEFAULT_PERMISSIONS[role][k]).sort();

  it("editor: view/edit products & templates, view orders, view CRM", () => {
    expect(trueKeysOf("editor")).toEqual(
      [
        "canViewProducts",
        "canEditProducts",
        "canViewTemplates",
        "canEditTemplates",
        "canViewOrders",
        "canViewCRM",
      ].sort(),
    );
  });

  it("customer_support: view/export/delete customers, view orders, view CRM", () => {
    expect(trueKeysOf("customer_support")).toEqual(
      [
        "canViewCustomers",
        "canExportCustomers",
        "canDeleteCustomer",
        "canViewOrders",
        "canViewCRM",
      ].sort(),
    );
  });

  it("web_designer: edit templates & branding, view products", () => {
    expect(trueKeysOf("web_designer")).toEqual(
      ["canViewTemplates", "canEditTemplates", "canManageBranding", "canViewProducts"].sort(),
    );
  });

  it("manager: view analytics/orders/customers, manage emails", () => {
    expect(trueKeysOf("manager")).toEqual(
      [
        "canViewAnalytics",
        "canViewOrders",
        "canViewCustomers",
        "canViewEmails",
        "canEditEmails",
      ].sort(),
    );
  });

  it("non-admin presets follow least privilege (not all-true)", () => {
    for (const role of TEAM_ROLES) {
      if (role === "admin") continue;
      const allTrue = PERMISSION_KEYS.every((k) => DEFAULT_PERMISSIONS[role][k]);
      expect(allTrue).toBe(false);
    }
  });

  it("no non-admin preset can delete team members or edit settings by default", () => {
    for (const role of TEAM_ROLES) {
      if (role === "admin") continue;
      expect(DEFAULT_PERMISSIONS[role].canDeleteTeamMembers).toBe(false);
      expect(DEFAULT_PERMISSIONS[role].canEditSettings).toBe(false);
    }
  });
});
