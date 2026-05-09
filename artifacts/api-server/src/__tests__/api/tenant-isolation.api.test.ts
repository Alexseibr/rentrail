import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../helpers";
import {
  createTestUser,
  createTestTenant,
  createTestClient,
  createTestAsset,
  assignRole,
  authHeaders,
  clearRolesCache,
  seedRolesAndPermissions,
  resBody,
  type TestUser,
  type TestTenant,
} from "../helpers";

describe("Multi-Tenant Isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let superAdmin: TestUser;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  let assetA: Awaited<ReturnType<typeof createTestAsset>>;
  let assetB: Awaited<ReturnType<typeof createTestAsset>>;
  let clientA: Awaited<ReturnType<typeof createTestClient>>;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenantA = await createTestTenant({ companyName: "Company Alpha" });
    tenantB = await createTestTenant({ companyName: "Company Beta" });

    userA = await createTestUser({ email: `iso-a-${Date.now()}@test.com` });
    userB = await createTestUser({ email: `iso-b-${Date.now()}@test.com` });
    superAdmin = await createTestUser({
      email: `iso-super-${Date.now()}@test.com`,
      isSuperAdmin: true,
    });

    await assignRole(userA.id, tenantA.company.id, "admin");
    await assignRole(userB.id, tenantB.company.id, "admin");

    assetA = await createTestAsset(tenantA.company.id, tenantA.branch.id, {
      stationId: tenantA.station.id,
    });
    assetB = await createTestAsset(tenantB.company.id, tenantB.branch.id, {
      stationId: tenantB.station.id,
    });
    clientA = await createTestClient(tenantA.company.id);
    await createTestClient(tenantB.company.id);
  }, 30000);

  describe("company-level isolation — assets", () => {
    it("user A can create asset in company A", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set(authHeaders(userA.token, tenantA.company.id))
        .send({
          assetType: "ebike",
          branchId: tenantA.branch.id,
          internalCode: "ALPHA-NEW-001",
        });

      expect(res.status).toBe(201);
    });

    it("user B cannot list company A assets via company A header", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(userB.token, tenantA.company.id));

      expect(res.status).toBe(403);
    });

    it("user B listing own company does not see company A assets", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(userB.token, tenantB.company.id));

      expect(res.status).toBe(200);
      const assetIds = (
        resBody<{ data: { id: string }[] }>(res).data || []
      ).map((a) => a.id);
      expect(assetIds).not.toContain(assetA.id);
      expect(assetIds).toContain(assetB.id);
    });

    it("user B cannot read company A asset by ID (IDOR)", async () => {
      const res = await request(testApp)
        .get(`/api/assets/${assetA.id}`)
        .set(authHeaders(userB.token, tenantB.company.id));

      expect([403, 404]).toContain(res.status);
    });

    it("user B cannot update company A asset by ID", async () => {
      const res = await request(testApp)
        .patch(`/api/assets/${assetA.id}`)
        .set(authHeaders(userB.token, tenantB.company.id))
        .send({ notes: "hacked" });

      expect([403, 404]).toContain(res.status);
    });

    it("user B cannot change status of company A asset", async () => {
      const res = await request(testApp)
        .post(`/api/assets/${assetA.id}/status`)
        .set(authHeaders(userB.token, tenantB.company.id))
        .send({ status: "maintenance", reason: "hacked" });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe("company-level isolation — rentals", () => {
    it("user B cannot create rental using company A client/asset", async () => {
      const res = await request(testApp)
        .post("/api/rentals")
        .set(authHeaders(userB.token, tenantB.company.id))
        .send({
          clientId: clientA.id,
          assetId: assetA.id,
          branchId: tenantA.branch.id,
        });

      expect(res.status).toBe(400);
    });

    let rentalIdA: string;
    it("user A can create rental in company A", async () => {
      const res = await request(testApp)
        .post("/api/rentals")
        .set(authHeaders(userA.token, tenantA.company.id))
        .send({
          clientId: clientA.id,
          assetId: assetA.id,
          branchId: tenantA.branch.id,
        });

      expect(res.status).toBe(201);
      rentalIdA = resBody<{ data: { id: string } }>(res).data.id;
    });

    it("user B cannot read company A rental by ID", async () => {
      const res = await request(testApp)
        .get(`/api/rentals/${rentalIdA}`)
        .set(authHeaders(userB.token, tenantB.company.id));

      expect([403, 404]).toContain(res.status);
    });

    it("user B cannot approve company A rental", async () => {
      const res = await request(testApp)
        .post(`/api/rentals/${rentalIdA}/approve`)
        .set(authHeaders(userB.token, tenantB.company.id));

      expect([403, 404]).toContain(res.status);
    });

    it("user B listing own company rentals does not see company A rental", async () => {
      const res = await request(testApp)
        .get("/api/rentals")
        .set(authHeaders(userB.token, tenantB.company.id));

      expect(res.status).toBe(200);
      const ids = (resBody<{ data: { id: string }[] }>(res).data || []).map(
        (r) => r.id,
      );
      expect(ids).not.toContain(rentalIdA);
    });
  });

  describe("superAdmin cross-tenant access", () => {
    it("superAdmin can list company A assets", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(superAdmin.token, tenantA.company.id));

      expect(res.status).toBe(200);
    });

    it("superAdmin can list company B rentals", async () => {
      const res = await request(testApp)
        .get("/api/rentals")
        .set(authHeaders(superAdmin.token, tenantB.company.id));

      expect(res.status).toBe(200);
    });
  });

  describe("missing / invalid context", () => {
    it("request without x-company-id is rejected", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${userA.token}`);

      expect(res.status).toBe(403);
    });

    it("unauthenticated request is rejected", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(401);
    });

    it("request with non-existent company id is rejected", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set(authHeaders(userA.token, "00000000-0000-0000-0000-000000000000"));

      expect(res.status).toBe(403);
    });
  });
});
