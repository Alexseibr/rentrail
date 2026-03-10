import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../helpers";
import {
  createTestUser,
  createTestTenant,
  assignRole,
  authHeaders,
  resBody,
  type TestUser,
  type TestTenant,
} from "../helpers";

describe("GET /api/rentals — status filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    tenant = await createTestTenant({ companyName: "Rental Status Filter Co" });
    admin = await createTestUser({
      email: `rental-status-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=bad_value — returns 400 with VALIDATION error code", async () => {
    const res = await request(testApp)
      .get("/api/rentals?status=bad_value")
      .set(h());

    expect(res.status).toBe(400);
    const errBody = resBody<{ error: { code: string } }>(res);
    expect(errBody.error.code).toBe("VALIDATION");
  });

  it("status=nonexistent_status — returns 400, not 500", async () => {
    const res = await request(testApp)
      .get("/api/rentals?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });

  it("status=active — returns 200", async () => {
    const res = await request(testApp)
      .get("/api/rentals?status=active")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("status=completed — returns 200", async () => {
    const res = await request(testApp)
      .get("/api/rentals?status=completed")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("status=canceled — returns 200", async () => {
    const res = await request(testApp)
      .get("/api/rentals?status=canceled")
      .set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("no status param — returns 200 with all records", async () => {
    const res = await request(testApp).get("/api/rentals").set(h());

    expect(res.status).toBe(200);
    const body = resBody<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
