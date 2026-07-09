import { describe, it, expect } from "vitest";
import { PERMISSION_KEYS, type PermissionSet } from "@/lib/permissions/permission-keys";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions/preset-roles";
import { resolvePermissions, permissionsFromRow, can } from "@/lib/permissions/resolve";

const allTrue = (set: PermissionSet) => PERMISSION_KEYS.every((k) => set[k] === true);
const allFalse = (set: PermissionSet) => PERMISSION_KEYS.every((k) => set[k] === false);

describe("resolvePermissions", () => {
  it("SUPER_ADMIN gets all permissions regardless of teamRole", () => {
    expect(allTrue(resolvePermissions({ role: "SUPER_ADMIN" }))).toBe(true);
    expect(allTrue(resolvePermissions({ role: "SUPER_ADMIN", teamRole: "editor" }))).toBe(true);
    expect(allTrue(resolvePermissions({ role: "SUPER_ADMIN", teamRole: "bogus" }))).toBe(true);
  });

  it("TENANT_ADMIN with 'admin' teamRole gets all permissions", () => {
    expect(allTrue(resolvePermissions({ role: "TENANT_ADMIN", teamRole: "admin" }))).toBe(true);
  });

  it("TENANT_ADMIN with null/undefined teamRole (legacy) gets all permissions", () => {
    expect(allTrue(resolvePermissions({ role: "TENANT_ADMIN", teamRole: null }))).toBe(true);
    expect(allTrue(resolvePermissions({ role: "TENANT_ADMIN" }))).toBe(true);
  });

  it("TENANT_ADMIN with a preset role (no stored row) gets the seeded defaults", () => {
    const set = resolvePermissions({ role: "TENANT_ADMIN", teamRole: "editor" });
    expect(set).toEqual(DEFAULT_PERMISSIONS.editor);
    expect(set.canEditProducts).toBe(true);
    expect(set.canDeleteCustomer).toBe(false);
  });

  it("TENANT_ADMIN with a stored row uses the row, not the defaults", () => {
    // Admin customised 'editor' to also allow deleting products.
    const customised = { canEditProducts: true, canDeleteProducts: true };
    const set = resolvePermissions({ role: "TENANT_ADMIN", teamRole: "editor" }, customised);
    expect(set.canDeleteProducts).toBe(true);
    expect(set.canEditProducts).toBe(true);
    // keys absent from the row default to false (complete set, fail-closed)
    expect(set.canViewCRM).toBe(false);
    expect(Object.keys(set).sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it("unknown teamRole fails closed (no permissions)", () => {
    expect(allFalse(resolvePermissions({ role: "TENANT_ADMIN", teamRole: "owner" }))).toBe(true);
  });

  it("PATIENT / non-tenant-admin roles get no permissions", () => {
    expect(allFalse(resolvePermissions({ role: "PATIENT", teamRole: "admin" }))).toBe(true);
    expect(allFalse(resolvePermissions({ role: "CONSUMER" }))).toBe(true);
    expect(allFalse(resolvePermissions({ role: "" }))).toBe(true);
  });
});

describe("permissionsFromRow", () => {
  it("null/undefined row => all false", () => {
    expect(allFalse(permissionsFromRow(null))).toBe(true);
    expect(allFalse(permissionsFromRow(undefined))).toBe(true);
  });

  it("returns a complete set from a partial row", () => {
    const set = permissionsFromRow({ canViewOrders: true, canEditOrders: false });
    expect(set.canViewOrders).toBe(true);
    expect(set.canEditOrders).toBe(false);
    expect(Object.keys(set).sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it("ignores non-permission fields on the row", () => {
    const rowLike = { id: "x", tenantId: "t", role: "editor", canViewProducts: true } as never;
    const set = permissionsFromRow(rowLike);
    expect(set.canViewProducts).toBe(true);
    expect(Object.keys(set).sort()).toEqual([...PERMISSION_KEYS].sort());
  });
});

describe("can", () => {
  it("reads a single permission from a resolved set", () => {
    const set = DEFAULT_PERMISSIONS.customer_support;
    expect(can(set, "canDeleteCustomer")).toBe(true);
    expect(can(set, "canEditProducts")).toBe(false);
  });
});
