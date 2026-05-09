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

describe("GET /api/maintenance-logs — logType filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Maint Log Filter Co" });
    admin = await createTestUser({
      email: `maint-log-filter-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("logType=bad_value — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/maintenance-logs?logType=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    // type-coverage:ignore-next-line
    const errBody = res.body as { error: { code: string } };
    expect(errBody.error.code).toBe("VALIDATION");
  });

  it("logType=nonexistent_type — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/maintenance-logs?logType=nonexistent_type")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("logType=inspection — returns 200 with valid logType", async () => {
    const res = await request(testApp)
      .get("/api/maintenance-logs?logType=inspection")
      .set(h());

    expect(res.status).toBe(200);
    // type-coverage:ignore-next-line
    const body = res.body as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("logType=oil_change — returns 200 with valid logType", async () => {
    const res = await request(testApp)
      .get("/api/maintenance-logs?logType=oil_change")
      .set(h());

    expect(res.status).toBe(200);
    // type-coverage:ignore-next-line
    const body = res.body as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("logType=brake_service — returns 200 with valid logType", async () => {
    const res = await request(testApp)
      .get("/api/maintenance-logs?logType=brake_service")
      .set(h());

    expect(res.status).toBe(200);
    // type-coverage:ignore-next-line
    const body = res.body as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("no logType param — returns 200 with all records", async () => {
    const res = await request(testApp).get("/api/maintenance-logs").set(h());

    expect(res.status).toBe(200);
    // type-coverage:ignore-next-line
    const body = res.body as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});
