import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import { cleanDatabase } from "../../test/setup";
import { createTestUser, createTestTenant, assignRole, authHeaders, clearRolesCache } from "../../test/helpers";
import { seedRolesAndPermissions } from "../../test/seed-rbac-inline";

describe("Multi-Tenant Isolation", () => {
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let superAdmin: Awaited<ReturnType<typeof createTestUser>>;
  let tenantA: Awaited<ReturnType<typeof createTestTenant>>;
  let tenantB: Awaited<ReturnType<typeof createTestTenant>>;

  beforeAll(async () => {
    await cleanDatabase();
    clearRolesCache();

    await seedRolesAndPermissions();

    tenantA = await createTestTenant({ companyName: "Company Alpha", slug: "alpha" });
    tenantB = await createTestTenant({ companyName: "Company Beta", slug: "beta" });

    userA = await createTestUser({ email: "user-a@alpha.com" });
    userB = await createTestUser({ email: "user-b@beta.com" });
    superAdmin = await createTestUser({ email: "super@admin.com", isSuperAdmin: true });

    await assignRole(userA.id, tenantA.company.id, "admin");
    await assignRole(userB.id, tenantB.company.id, "admin");
  }, 30000);

  afterAll(async () => {
    await cleanDatabase();
  });

  describe("company-level isolation", () => {
    let assetIdA: string;

    it("user A can create asset in company A", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set(authHeaders(userA.token, tenantA.company.id))
        .send({
          assetType: "bike",
          branchId: tenantA.branch.id,
          stationId: tenantA.station.id,
          internalCode: "ALPHA-001",
        });

      expect(res.status).toBe(201);
      assetIdA = res.body.data.id;
    });

    it("user B cannot access company A context", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(userB.token, tenantA.company.id));

      expect(res.status).toBe(403);
    });

    it("user B cannot read company A assets via their own company", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(userB.token, tenantB.company.id));

      expect(res.status).toBe(200);
      const assetIds = (res.body.data || []).map((a: { id: string }) => a.id);
      expect(assetIds).not.toContain(assetIdA);
    });

    it("user A cannot access company B context", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(userA.token, tenantB.company.id));

      expect(res.status).toBe(403);
    });
  });

  describe("superAdmin override", () => {
    it("superAdmin can access company A assets", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(superAdmin.token, tenantA.company.id));

      expect(res.status).toBe(200);
    });

    it("superAdmin can access company B assets", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(superAdmin.token, tenantB.company.id));

      expect(res.status).toBe(200);
    });
  });

  describe("missing company context", () => {
    it("request without x-company-id is rejected", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${userA.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("unauthorized access", () => {
    it("unauthenticated request is rejected", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(401);
    });
  });
});
