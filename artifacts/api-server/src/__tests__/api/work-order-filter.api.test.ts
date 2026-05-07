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

describe("GET /api/work-orders — assignedToUserId filter", () => {
  let admin: TestUser;
  let userA: TestUser;
  let userB: TestUser;
  let tenant: TestTenant;

  let woAssignedToA: string;
  let woAssignedToB: string;
  let woUnassigned: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "WO Filter Co" });
    admin = await createTestUser({ email: `wo-admin-${Date.now()}@test.com` });
    userA = await createTestUser({
      email: `wo-userA-${Date.now()}@test.com`,
      firstName: "Alice",
      lastName: "Smith",
    });
    userB = await createTestUser({
      email: `wo-userB-${Date.now()}@test.com`,
      firstName: "Bob",
      lastName: "Jones",
    });

    await assignRole(admin.id, tenant.company.id, "admin");
    await assignRole(userA.id, tenant.company.id, "mechanic");
    await assignRole(userB.id, tenant.company.id, "mechanic");

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resA = await request(testApp).post("/api/work-orders").set(h()).send({
      title: "Work Order for UserA",
      orderType: "field_repair",
      assignedToUserId: userA.id,
    });
    expect(resA.status).toBe(201);
    woAssignedToA = resA.body.data.id;

    const resB = await request(testApp).post("/api/work-orders").set(h()).send({
      title: "Work Order for UserB",
      orderType: "workshop_repair",
      assignedToUserId: userB.id,
    });
    expect(resB.status).toBe(201);
    woAssignedToB = resB.body.data.id;

    const resU = await request(testApp).post("/api/work-orders").set(h()).send({
      title: "Unassigned Work Order",
      orderType: "inspection",
    });
    expect(resU.status).toBe(201);
    woUnassigned = resU.body.data.id;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("without filter — returns all work orders including all three", async () => {
    const res = await request(testApp).get("/api/work-orders").set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woAssignedToA);
    expect(ids).toContain(woAssignedToB);
    expect(ids).toContain(woUnassigned);
  });

  it("assignedToUserId=userA.id — returns only userA's work order", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?assignedToUserId=${userA.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woAssignedToA);
    expect(ids).not.toContain(woAssignedToB);
    expect(ids).not.toContain(woUnassigned);
  });

  it("assignedToUserId=userB.id — returns only userB's work order", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?assignedToUserId=${userB.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woAssignedToB);
    expect(ids).not.toContain(woAssignedToA);
    expect(ids).not.toContain(woUnassigned);
  });

  it("assignedToUserId with unknown user id — returns empty list", async () => {
    const res = await request(testApp)
      .get(
        "/api/work-orders?assignedToUserId=00000000-0000-0000-0000-000000000000",
      )
      .set(h());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("each filtered result has the correct assignedToUserId", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?assignedToUserId=${userA.id}`)
      .set(h());

    expect(res.status).toBe(200);
    for (const wo of res.body.data) {
      expect(wo.assignedToUserId).toBe(userA.id);
    }
  });
});
