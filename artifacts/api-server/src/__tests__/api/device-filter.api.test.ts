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
import { resBody } from "../helpers";

describe("GET /api/devices — enum filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Device Filter Co" });
    admin = await createTestUser({
      email: `device-filter-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=bad_value — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/devices?status=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    const errBody = resBody<{ error: { code: string } }>(res);
    expect(errBody.error.code).toBe("VALIDATION");
  });

  it("status=nonexistent_status — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/devices?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("deviceType=bad_type — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/devices?deviceType=bad_type")
      .set(h());

    expect(res.status).toBe(400);
    const errBody = resBody<{ error: { code: string } }>(res);
    expect(errBody.error.code).toBe("VALIDATION");
  });

  it("deviceType=unknown — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/devices?deviceType=unknown")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("status=active — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/devices?status=active")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("status=maintenance — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/devices?status=maintenance")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("deviceType=gps_tracker — returns 200 with valid deviceType", async () => {
    const res = await request(testApp)
      .get("/api/devices?deviceType=gps_tracker")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("deviceType=smart_lock — returns 200 with valid deviceType", async () => {
    const res = await request(testApp)
      .get("/api/devices?deviceType=smart_lock")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("no filters — returns 200 with all records", async () => {
    const res = await request(testApp).get("/api/devices").set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
