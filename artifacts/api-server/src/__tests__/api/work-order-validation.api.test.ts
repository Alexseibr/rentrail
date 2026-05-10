import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../helpers";
import {
  createTestUser,
  createTestTenant,
  assignRole,
  authHeaders,
  clearRolesCache,
  seedRolesAndPermissions,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

describe("GET /api/work-orders — status filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "WO Status Filter Co" });
    admin = await createTestUser({
      email: `wo-status-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=bad_value — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    expect(resBody<ApiResponse>(res).error.code).toBe("VALIDATION");
  });

  it("status=nonexistent_status — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("status=bad_value — error message mentions the invalid value", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    const body = resBody<ApiResponse>(res);
    expect(body.error.message).toContain("bad_value");
  });

  it("status=draft — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=draft")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("status=assigned — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=assigned")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("status=in_progress — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("status=waiting_parts — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=waiting_parts")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("status=completed — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=completed")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("status=canceled — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=canceled")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("status=en_route — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=en_route")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });

  it("no status param — returns 200 with all records", async () => {
    const res = await request(testApp).get("/api/work-orders").set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
  });
});
