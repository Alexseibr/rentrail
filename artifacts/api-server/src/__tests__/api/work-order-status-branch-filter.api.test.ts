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
import { db, branches } from "@workspace/db";

describe("GET /api/work-orders — status filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  let woDraft: string;
  let woInProgress: string;
  let woCompleted: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "WO Status Filter Co" });
    admin = await createTestUser({
      email: `wo-status-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resDraft = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({ title: "Draft WO", orderType: "inspection" });
    expect(resDraft.status).toBe(201);
    woDraft = resDraft.body.data.id;

    const resInProgress = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({ title: "In-Progress WO", orderType: "field_repair" });
    expect(resInProgress.status).toBe(201);
    woInProgress = resInProgress.body.data.id;

    await request(testApp)
      .post(`/api/work-orders/${woInProgress}/status`)
      .set(h())
      .send({ status: "in_progress" });

    const resCompleted = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({ title: "Completed WO", orderType: "workshop_repair" });
    expect(resCompleted.status).toBe(201);
    woCompleted = resCompleted.body.data.id;

    await request(testApp)
      .post(`/api/work-orders/${woCompleted}/status`)
      .set(h())
      .send({ status: "completed" });
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=draft — returns only draft work orders", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=draft")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woDraft);
    expect(ids).not.toContain(woInProgress);
    expect(ids).not.toContain(woCompleted);
  });

  it("status=in_progress — returns only in_progress work orders", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woInProgress);
    expect(ids).not.toContain(woDraft);
    expect(ids).not.toContain(woCompleted);
  });

  it("status=completed — returns only completed work orders", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=completed")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woCompleted);
    expect(ids).not.toContain(woDraft);
    expect(ids).not.toContain(woInProgress);
  });

  it("each filtered result has the correct status field", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    for (const wo of res.body.data) {
      expect(wo.status).toBe("in_progress");
    }
  });

  it("status with unknown value — returns 400 validation error", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });
});

describe("GET /api/work-orders — branchId filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let branchBId: string;

  let woBranchA: string;
  let woBranchB: string;
  let woNoBranch: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "WO Branch Filter Co" });
    admin = await createTestUser({
      email: `wo-branch-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");

    const [branchB] = await db
      .insert(branches)
      .values({ companyId: tenant.company.id, name: "Branch B" })
      .returning();
    branchBId = branchB.id;

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resA = await request(testApp).post("/api/work-orders").set(h()).send({
      title: "WO for Branch A",
      orderType: "inspection",
      branchId: tenant.branch.id,
    });
    expect(resA.status).toBe(201);
    woBranchA = resA.body.data.id;

    const resB = await request(testApp).post("/api/work-orders").set(h()).send({
      title: "WO for Branch B",
      orderType: "field_repair",
      branchId: branchBId,
    });
    expect(resB.status).toBe(201);
    woBranchB = resB.body.data.id;

    const resNone = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({ title: "WO without Branch", orderType: "workshop_repair" });
    expect(resNone.status).toBe(201);
    woNoBranch = resNone.body.data.id;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("branchId=branchA.id — returns only branch A work orders", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woBranchA);
    expect(ids).not.toContain(woBranchB);
    expect(ids).not.toContain(woNoBranch);
  });

  it("branchId=branchB.id — returns only branch B work orders", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woBranchB);
    expect(ids).not.toContain(woBranchA);
    expect(ids).not.toContain(woNoBranch);
  });

  it("each filtered result has the correct branchId field", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    for (const wo of res.body.data) {
      expect(wo.branchId).toBe(branchBId);
    }
  });

  it("branchId with unknown id — returns empty list", async () => {
    const res = await request(testApp)
      .get("/api/work-orders?branchId=00000000-0000-0000-0000-000000000000")
      .set(h());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("GET /api/work-orders — combined status + branchId filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let branchBId: string;

  let woBranchADraft: string;
  let woBranchACompleted: string;
  let woBranchBDraft: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "WO Combined Filter Co" });
    admin = await createTestUser({
      email: `wo-combined-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");

    const [branchB] = await db
      .insert(branches)
      .values({ companyId: tenant.company.id, name: "Branch B Combined" })
      .returning();
    branchBId = branchB.id;

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resADraft = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({
        title: "Branch A Draft",
        orderType: "inspection",
        branchId: tenant.branch.id,
      });
    expect(resADraft.status).toBe(201);
    woBranchADraft = resADraft.body.data.id;

    const resACompleted = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({
        title: "Branch A Completed",
        orderType: "inspection",
        branchId: tenant.branch.id,
      });
    expect(resACompleted.status).toBe(201);
    woBranchACompleted = resACompleted.body.data.id;

    await request(testApp)
      .post(`/api/work-orders/${woBranchACompleted}/status`)
      .set(h())
      .send({ status: "completed" });

    const resBDraft = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({
        title: "Branch B Draft",
        orderType: "field_repair",
        branchId: branchBId,
      });
    expect(resBDraft.status).toBe(201);
    woBranchBDraft = resBDraft.body.data.id;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=draft + branchId=A — returns only draft WOs in branch A", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?status=draft&branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woBranchADraft);
    expect(ids).not.toContain(woBranchACompleted);
    expect(ids).not.toContain(woBranchBDraft);
  });

  it("status=completed + branchId=A — returns only the completed WO in branch A", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?status=completed&branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woBranchACompleted);
    expect(ids).not.toContain(woBranchADraft);
    expect(ids).not.toContain(woBranchBDraft);
  });

  it("status=draft + branchId=B — returns only draft WOs in branch B", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?status=draft&branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).toContain(woBranchBDraft);
    expect(ids).not.toContain(woBranchADraft);
    expect(ids).not.toContain(woBranchACompleted);
  });

  it("status=completed + branchId=B — returns empty (no completed WOs in branch B)", async () => {
    const res = await request(testApp)
      .get(`/api/work-orders?status=completed&branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((wo: { id: string }) => wo.id);
    expect(ids).not.toContain(woBranchADraft);
    expect(ids).not.toContain(woBranchACompleted);
    expect(ids).not.toContain(woBranchBDraft);
  });

  it("all three filters together (status + branchId + assignedToUserId) still works", async () => {
    const res = await request(testApp)
      .get(
        `/api/work-orders?status=draft&branchId=${tenant.branch.id}&assignedToUserId=00000000-0000-0000-0000-000000000000`,
      )
      .set(h());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});
