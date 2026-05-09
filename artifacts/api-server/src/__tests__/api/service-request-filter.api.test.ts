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

type _RB = {
  data: Record<string, unknown>;
  error: { code: string; message: string };
};
function rb(r: { body: unknown }): _RB {
  return r.body as _RB;
}

describe("GET /api/service-requests — status filter validation", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "SR Status Filter Co" });
    admin = await createTestUser({
      email: `sr-status-admin-${Date.now()}@test.com`,
    });
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
    expect(rb(res).error.code).toBe("VALIDATION");
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
    expect(Array.isArray(rb(res).data)).toBe(true);
  });

  it("status=in_progress — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(rb(res).data)).toBe(true);
  });

  it("status=completed — returns 200 with valid status", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=completed")
      .set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(rb(res).data)).toBe(true);
  });

  it("no status param — returns 200 with all records", async () => {
    const res = await request(testApp).get("/api/service-requests").set(h());

    expect(res.status).toBe(200);
    expect(Array.isArray(rb(res).data)).toBe(true);
  });
});

describe("GET /api/service-requests — status filter correctness", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  let srNew: string;
  let srInProgress: string;
  let srCompleted: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({
      companyName: "SR Status Correctness Co",
    });
    admin = await createTestUser({
      email: `sr-correctness-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resNew = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "breakdown",
        title: "New SR",
      });
    expect(resNew.status).toBe(201);
    srNew = rb(resNew).data.id as string;

    const resInProgress = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "flat_tire",
        title: "In-Progress SR",
      });
    expect(resInProgress.status).toBe(201);
    srInProgress = rb(resInProgress).data.id as string;

    await request(testApp)
      .post(`/api/service-requests/${srInProgress}/status`)
      .set(h())
      .send({ status: "in_progress" });

    const resCompleted = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "inspection",
        title: "Completed SR",
      });
    expect(resCompleted.status).toBe(201);
    srCompleted = rb(resCompleted).data.id as string;

    await request(testApp)
      .post(`/api/service-requests/${srCompleted}/status`)
      .set(h())
      .send({ status: "completed" });
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("without filter — returns all service requests including all three", async () => {
    const res = await request(testApp).get("/api/service-requests").set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srNew);
    expect(ids).toContain(srInProgress);
    expect(ids).toContain(srCompleted);
  });

  it("status=new — returns only new service requests", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=new")
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srNew);
    expect(ids).not.toContain(srInProgress);
    expect(ids).not.toContain(srCompleted);
  });

  it("status=in_progress — returns only in_progress service requests", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srInProgress);
    expect(ids).not.toContain(srNew);
    expect(ids).not.toContain(srCompleted);
  });

  it("status=completed — returns only completed service requests", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=completed")
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srCompleted);
    expect(ids).not.toContain(srNew);
    expect(ids).not.toContain(srInProgress);
  });

  it("each filtered result has the correct status field", async () => {
    const res = await request(testApp)
      .get("/api/service-requests?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    for (const sr of rb(res).data as unknown as Array<
      Record<string, unknown>
    >) {
      expect(sr.status).toBe("in_progress");
    }
  });
});

describe("GET /api/service-requests — branchId filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let branchBId: string;

  let srBranchA: string;
  let srBranchB: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "SR Branch Filter Co" });
    admin = await createTestUser({
      email: `sr-branch-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");

    const [branchB] = await db
      .insert(branches)
      .values({ companyId: tenant.company.id, name: "SR Branch B" })
      .returning();
    branchBId = branchB.id;

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resA = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "breakdown",
        title: "SR for Branch A",
      });
    expect(resA.status).toBe(201);
    srBranchA = rb(resA).data.id as string;

    const resB = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: branchBId,
        requestType: "flat_tire",
        title: "SR for Branch B",
      });
    expect(resB.status).toBe(201);
    srBranchB = rb(resB).data.id as string;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("branchId=branchA.id — returns only branch A service requests", async () => {
    const res = await request(testApp)
      .get(`/api/service-requests?branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srBranchA);
    expect(ids).not.toContain(srBranchB);
  });

  it("branchId=branchB.id — returns only branch B service requests", async () => {
    const res = await request(testApp)
      .get(`/api/service-requests?branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srBranchB);
    expect(ids).not.toContain(srBranchA);
  });

  it("each filtered result has the correct branchId field", async () => {
    const res = await request(testApp)
      .get(`/api/service-requests?branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    for (const sr of rb(res).data as unknown as Array<
      Record<string, unknown>
    >) {
      expect(sr.branchId).toBe(branchBId);
    }
  });

  it("branchId with unknown id — returns empty list", async () => {
    const res = await request(testApp)
      .get(
        "/api/service-requests?branchId=00000000-0000-0000-0000-000000000000",
      )
      .set(h());

    expect(res.status).toBe(200);
    expect(rb(res).data).toHaveLength(0);
  });
});

describe("GET /api/service-requests — combined status + branchId filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let branchBId: string;

  let srBranchANew: string;
  let srBranchACompleted: string;
  let srBranchBNew: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "SR Combined Filter Co" });
    admin = await createTestUser({
      email: `sr-combined-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin");

    const [branchB] = await db
      .insert(branches)
      .values({ companyId: tenant.company.id, name: "SR Branch B Combined" })
      .returning();
    branchBId = branchB.id;

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resANew = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "breakdown",
        title: "Branch A New SR",
      });
    expect(resANew.status).toBe(201);
    srBranchANew = rb(resANew).data.id as string;

    const resACompleted = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "inspection",
        title: "Branch A Completed SR",
      });
    expect(resACompleted.status).toBe(201);
    srBranchACompleted = rb(resACompleted).data.id as string;

    await request(testApp)
      .post(`/api/service-requests/${srBranchACompleted}/status`)
      .set(h())
      .send({ status: "completed" });

    const resBNew = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: branchBId,
        requestType: "flat_tire",
        title: "Branch B New SR",
      });
    expect(resBNew.status).toBe(201);
    srBranchBNew = rb(resBNew).data.id as string;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=new + branchId=A — returns only new SRs in branch A", async () => {
    const res = await request(testApp)
      .get(`/api/service-requests?status=new&branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srBranchANew);
    expect(ids).not.toContain(srBranchACompleted);
    expect(ids).not.toContain(srBranchBNew);
  });

  it("status=completed + branchId=A — returns only the completed SR in branch A", async () => {
    const res = await request(testApp)
      .get(
        `/api/service-requests?status=completed&branchId=${tenant.branch.id}`,
      )
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srBranchACompleted);
    expect(ids).not.toContain(srBranchANew);
    expect(ids).not.toContain(srBranchBNew);
  });

  it("status=new + branchId=B — returns only new SRs in branch B", async () => {
    const res = await request(testApp)
      .get(`/api/service-requests?status=new&branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).toContain(srBranchBNew);
    expect(ids).not.toContain(srBranchANew);
    expect(ids).not.toContain(srBranchACompleted);
  });

  it("status=completed + branchId=B — returns empty (no completed SRs in branch B)", async () => {
    const res = await request(testApp)
      .get(`/api/service-requests?status=completed&branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = (rb(res).data as unknown as Array<Record<string, unknown>>).map(
      (sr: Record<string, unknown>) => sr.id as string,
    );
    expect(ids).not.toContain(srBranchANew);
    expect(ids).not.toContain(srBranchACompleted);
    expect(ids).not.toContain(srBranchBNew);
  });
});
