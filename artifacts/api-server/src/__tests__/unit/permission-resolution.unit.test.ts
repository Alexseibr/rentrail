import { describe, it, expect } from "vitest";

function hasPermission(userPerms: Set<string>, required: string): boolean {
  return userPerms.has(required);
}

function hasAllPermissions(userPerms: Set<string>, required: string[]): boolean {
  return required.every((code) => userPerms.has(code));
}

function hasAnyPermission(userPerms: Set<string>, required: string[]): boolean {
  return required.some((code) => userPerms.has(code));
}

function superAdminBypass(isSuperAdmin: boolean, _required: string[]): boolean {
  return isSuperAdmin;
}

describe("Permission Resolution", () => {
  const adminPerms = new Set([
    "company:read", "company:update",
    "branch:create", "branch:read", "branch:update", "branch:delete",
    "asset:create", "asset:read", "asset:update", "asset:changeStatus",
    "rental:create", "rental:read", "rental:update", "rental:approve", "rental:start", "rental:complete",
    "client:create", "client:read", "client:update",
    "payment:create", "payment:read",
  ]);

  const viewerPerms = new Set([
    "company:read",
    "branch:read",
    "asset:read",
    "rental:read",
    "client:read",
    "payment:read",
  ]);

  const operatorPerms = new Set([
    "asset:read", "asset:changeStatus",
    "rental:read", "rental:start", "rental:complete",
    "client:read",
  ]);

  describe("hasPermission", () => {
    it("admin has asset:create", () => {
      expect(hasPermission(adminPerms, "asset:create")).toBe(true);
    });

    it("viewer does not have asset:create", () => {
      expect(hasPermission(viewerPerms, "asset:create")).toBe(false);
    });

    it("operator has rental:start", () => {
      expect(hasPermission(operatorPerms, "rental:start")).toBe(true);
    });

    it("operator does not have rental:approve", () => {
      expect(hasPermission(operatorPerms, "rental:approve")).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("admin has all asset CRUD", () => {
      expect(hasAllPermissions(adminPerms, ["asset:create", "asset:read", "asset:update"])).toBe(true);
    });

    it("viewer lacks write permissions", () => {
      expect(hasAllPermissions(viewerPerms, ["asset:create", "asset:read"])).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("viewer has at least one of create/read", () => {
      expect(hasAnyPermission(viewerPerms, ["asset:create", "asset:read"])).toBe(true);
    });

    it("viewer has none of write permissions", () => {
      expect(hasAnyPermission(viewerPerms, ["asset:create", "asset:update", "asset:delete"])).toBe(false);
    });
  });

  describe("superAdmin bypass", () => {
    it("superAdmin bypasses all permission checks", () => {
      expect(superAdminBypass(true, ["anything:everything"])).toBe(true);
    });

    it("non-superAdmin does not bypass", () => {
      expect(superAdminBypass(false, ["asset:read"])).toBe(false);
    });
  });
});
