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

describe("GET /api/incidents — status filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;

  let incidentOpen: string;
  let incidentInProgress: string;
  let incidentResolved: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Incident Status Filter Co" });
    admin = await createTestUser({ email: `incident-status-admin-${Date.now()}@test.com` });
    await assignRole(admin.id, tenant.company.id, "admin");

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resOpen = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Open Incident", severity: "medium" });
    expect(resOpen.status).toBe(201);
    incidentOpen = resOpen.body.data.id;

    const resInProgress = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "In-Progress Incident", severity: "high" });
    expect(resInProgress.status).toBe(201);
    incidentInProgress = resInProgress.body.data.id;

    await request(testApp)
      .post(`/api/incidents/${incidentInProgress}/status`)
      .set(h())
      .send({ status: "in_progress" });

    const resResolved = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Resolved Incident", severity: "low" });
    expect(resResolved.status).toBe(201);
    incidentResolved = resResolved.body.data.id;

    await request(testApp)
      .post(`/api/incidents/${incidentResolved}/status`)
      .set(h())
      .send({ status: "resolved" });
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("without filter — returns all incidents including all three", async () => {
    const res = await request(testApp)
      .get("/api/incidents")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentOpen);
    expect(ids).toContain(incidentInProgress);
    expect(ids).toContain(incidentResolved);
  });

  it("status=open — returns only open incidents", async () => {
    const res = await request(testApp)
      .get("/api/incidents?status=open")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentOpen);
    expect(ids).not.toContain(incidentInProgress);
    expect(ids).not.toContain(incidentResolved);
  });

  it("status=in_progress — returns only in_progress incidents", async () => {
    const res = await request(testApp)
      .get("/api/incidents?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentInProgress);
    expect(ids).not.toContain(incidentOpen);
    expect(ids).not.toContain(incidentResolved);
  });

  it("status=resolved — returns only resolved incidents", async () => {
    const res = await request(testApp)
      .get("/api/incidents?status=resolved")
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentResolved);
    expect(ids).not.toContain(incidentOpen);
    expect(ids).not.toContain(incidentInProgress);
  });

  it("each filtered result has the correct status field", async () => {
    const res = await request(testApp)
      .get("/api/incidents?status=in_progress")
      .set(h());

    expect(res.status).toBe(200);
    for (const incident of res.body.data) {
      expect(incident.status).toBe("in_progress");
    }
  });

  it("status with unknown value — returns 400 validation error", async () => {
    const res = await request(testApp)
      .get("/api/incidents?status=nonexistent_status")
      .set(h());

    expect(res.status).toBe(400);
  });
});

describe("GET /api/incidents — branchId filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let branchBId: string;

  let incidentBranchA: string;
  let incidentBranchB: string;
  let incidentNoBranch: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Incident Branch Filter Co" });
    admin = await createTestUser({ email: `incident-branch-admin-${Date.now()}@test.com` });
    await assignRole(admin.id, tenant.company.id, "admin");

    const [branchB] = await db
      .insert(branches)
      .values({ companyId: tenant.company.id, name: "Incident Branch B" })
      .returning();
    branchBId = branchB.id;

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resA = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Incident for Branch A", branchId: tenant.branch.id, severity: "medium" });
    expect(resA.status).toBe(201);
    incidentBranchA = resA.body.data.id;

    const resB = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Incident for Branch B", branchId: branchBId, severity: "high" });
    expect(resB.status).toBe(201);
    incidentBranchB = resB.body.data.id;

    const resNone = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Incident without Branch", severity: "low" });
    expect(resNone.status).toBe(201);
    incidentNoBranch = resNone.body.data.id;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("branchId=branchA.id — returns only branch A incidents", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentBranchA);
    expect(ids).not.toContain(incidentBranchB);
    expect(ids).not.toContain(incidentNoBranch);
  });

  it("branchId=branchB.id — returns only branch B incidents", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentBranchB);
    expect(ids).not.toContain(incidentBranchA);
    expect(ids).not.toContain(incidentNoBranch);
  });

  it("each filtered result has the correct branchId field", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    for (const incident of res.body.data) {
      expect(incident.branchId).toBe(branchBId);
    }
  });

  it("branchId with unknown id — returns empty list", async () => {
    const res = await request(testApp)
      .get("/api/incidents?branchId=00000000-0000-0000-0000-000000000000")
      .set(h());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("GET /api/incidents — combined status + branchId filter", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let branchBId: string;

  let incidentBranchAOpen: string;
  let incidentBranchAResolved: string;
  let incidentBranchBOpen: string;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Incident Combined Filter Co" });
    admin = await createTestUser({ email: `incident-combined-admin-${Date.now()}@test.com` });
    await assignRole(admin.id, tenant.company.id, "admin");

    const [branchB] = await db
      .insert(branches)
      .values({ companyId: tenant.company.id, name: "Incident Branch B Combined" })
      .returning();
    branchBId = branchB.id;

    function h() {
      return authHeaders(admin.token, tenant.company.id);
    }

    const resAOpen = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Branch A Open", branchId: tenant.branch.id, severity: "medium" });
    expect(resAOpen.status).toBe(201);
    incidentBranchAOpen = resAOpen.body.data.id;

    const resAResolved = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Branch A Resolved", branchId: tenant.branch.id, severity: "low" });
    expect(resAResolved.status).toBe(201);
    incidentBranchAResolved = resAResolved.body.data.id;

    await request(testApp)
      .post(`/api/incidents/${incidentBranchAResolved}/status`)
      .set(h())
      .send({ status: "resolved" });

    const resBOpen = await request(testApp)
      .post("/api/incidents")
      .set(h())
      .send({ title: "Branch B Open", branchId: branchBId, severity: "high" });
    expect(resBOpen.status).toBe(201);
    incidentBranchBOpen = resBOpen.body.data.id;
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  it("status=open + branchId=A — returns only open incidents in branch A", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?status=open&branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentBranchAOpen);
    expect(ids).not.toContain(incidentBranchAResolved);
    expect(ids).not.toContain(incidentBranchBOpen);
  });

  it("status=resolved + branchId=A — returns only the resolved incident in branch A", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?status=resolved&branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentBranchAResolved);
    expect(ids).not.toContain(incidentBranchAOpen);
    expect(ids).not.toContain(incidentBranchBOpen);
  });

  it("status=open + branchId=B — returns only open incidents in branch B", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?status=open&branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).toContain(incidentBranchBOpen);
    expect(ids).not.toContain(incidentBranchAOpen);
    expect(ids).not.toContain(incidentBranchAResolved);
  });

  it("status=resolved + branchId=B — returns empty (no resolved incidents in branch B)", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?status=resolved&branchId=${branchBId}`)
      .set(h());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(incidentBranchAOpen);
    expect(ids).not.toContain(incidentBranchAResolved);
    expect(ids).not.toContain(incidentBranchBOpen);
  });

  it("status=invalid_value — returns 400 with combined filters too", async () => {
    const res = await request(testApp)
      .get(`/api/incidents?status=bad_status&branchId=${tenant.branch.id}`)
      .set(h());

    expect(res.status).toBe(400);
  });
});
