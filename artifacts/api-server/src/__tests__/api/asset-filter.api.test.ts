import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import {
  createTestUser,
  createTestTenant,
  assignRole,
  authHeaders,
  clearRolesCache,
  type TestUser,
  type TestTenant,
} from "../../test/helpers";
import { seedRolesAndPermissions } from "../../test/seed-rbac-inline";

describe("GET /api/assets — status filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Asset Status Filter Co" });
    admin = await createTestUser({
      email: `asset-status-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=bad_value — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/assets?status=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("status=nonexistent_status — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/assets?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("status=available — returns 200", async () => {
    const res = await request(testApp)
      .get("/api/assets?status=available")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("status=maintenance — returns 200", async () => {
    const res = await request(testApp)
      .get("/api/assets?status=maintenance")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("status=rented — returns 200", async () => {
    const res = await request(testApp)
      .get("/api/assets?status=rented")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("no status param — returns 200 with all records", async () => {
    const res = await request(testApp).get("/api/assets").set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
