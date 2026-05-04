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

describe("GET /api/service-requests — status filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "SR Status Filter Co" });
    admin = await createTestUser({ email: `sr-status-admin-${Date.now()}@test.com` });
    await assignRole(admin.id, tenant.company.id, "admin");
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=bad_value — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("status=nonexistent_status — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("status=new — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=new")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("status=in_progress — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("status=completed — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=completed")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("no status param — returns 200 with all records", async () => {
    const res = await request(testApp)
      .get("/api/service-requests")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
