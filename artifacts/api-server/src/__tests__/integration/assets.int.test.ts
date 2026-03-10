import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  testApp,
  acquireTestLock,
  cleanDatabase,
  clearRolesCache,
  seedRolesAndPermissions,
  createTestUser,
  createTestTenant,
  createTestAsset,
  assignRole,
  authHeaders,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

describe("Assets — integration", () => {
  let owner: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Assets Int Co" });
    owner = await createTestUser({
      email: `assets-owner-${Date.now()}@test.com`,
    });
    await assignRole(owner.id, tenant.company.id, "owner", tenant.branch.id);
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h() {
    return authHeaders(owner.token, tenant.company.id, tenant.branch.id);
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  describe("GET /api/assets", () => {
    it("returns a list for the company", async () => {
      const res = await request(testApp).get("/api/assets").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("returns 401 without a token", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("filters by status", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
        internalCode: `FL-AVAIL-${suffix}`,
      });
      await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "ebike",
        status: "maintenance",
        internalCode: `FL-MAINT-${suffix}`,
      });

      const res = await request(testApp)
        .get("/api/assets?status=maintenance")
        .set(h());

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data as unknown as Array<{
        status: string;
      }>;
      expect(data.every((a) => a.status === "maintenance")).toBe(true);
    });
  });

  // ─── Create ───────────────────────────────────────────────────────────────────

  describe("POST /api/assets", () => {
    it("creates an asset and returns the persisted record", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const res = await request(testApp)
        .post("/api/assets")
        .set(h())
        .send({
          branchId: tenant.branch.id,
          assetType: "ebike",
          brand: "Trek",
          model: "FX3",
          internalCode: `CREATE-${suffix}`,
        });

      expect(res.status).toBe(201);
      const asset = resBody<ApiResponse>(res).data;
      expect(asset).toMatchObject({
        branchId: tenant.branch.id,
        assetType: "ebike",
        brand: "Trek",
      });
      expect(asset).toHaveProperty("id");
    });

    it("defaults status to 'draft' when not specified", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set(h())
        .send({ branchId: tenant.branch.id, assetType: "bike" });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.status).toBe("draft");
    });

    it("accepts an explicit initial status", async () => {
      const res = await request(testApp).post("/api/assets").set(h()).send({
        branchId: tenant.branch.id,
        assetType: "scooter",
        status: "available",
      });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.status).toBe("available");
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set("x-company-id", tenant.company.id)
        .send({ branchId: tenant.branch.id, assetType: "bike" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for a user with no role in the company", async () => {
      const stranger = await createTestUser({
        email: `stranger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });

      const res = await request(testApp)
        .post("/api/assets")
        .set(authHeaders(stranger.token, tenant.company.id))
        .send({ branchId: tenant.branch.id, assetType: "bike" });

      expect(res.status).toBe(403);
    });

    it("rejects an invalid assetType", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set(h())
        .send({ branchId: tenant.branch.id, assetType: "hoverboard" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects missing branchId", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set(h())
        .send({ assetType: "bike" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Get by ID ────────────────────────────────────────────────────────────────

  describe("GET /api/assets/:id", () => {
    it("returns the asset by id", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        internalCode: `FIND-${suffix}`,
      });

      const res = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(asset.id);
    });

    it("returns 404 for an unknown id", async () => {
      const res = await request(testApp)
        .get("/api/assets/00000000-0000-0000-0000-000000000000")
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── Update ───────────────────────────────────────────────────────────────────

  describe("PATCH /api/assets/:id", () => {
    it("updates editable fields and returns the updated asset", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "scooter",
      });

      const res = await request(testApp)
        .patch(`/api/assets/${asset.id}`)
        .set(h())
        .send({ brand: "Xiaomi", model: "Pro 2" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.brand).toBe("Xiaomi");
      expect(resBody<ApiResponse>(res).data.model).toBe("Pro 2");
    });

    it("returns 404 for an unknown id", async () => {
      const res = await request(testApp)
        .patch("/api/assets/00000000-0000-0000-0000-000000000000")
        .set(h())
        .send({ brand: "Ghost" });

      expect(res.status).toBe(404);
    });
  });

  // ─── Status transition ────────────────────────────────────────────────────────

  describe("POST /api/assets/:id/status", () => {
    it("transitions available → maintenance", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "maintenance", reason: "Scheduled service" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("maintenance");
    });

    it("transitions maintenance → available", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "maintenance",
      });

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "available" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("available");
    });

    it("rejects invalid transition available → overdue with 422", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "overdue" });

      expect(res.status).toBe(422);
    });

    it("rejects unknown status with 4xx", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "flying" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 404 for an unknown asset id", async () => {
      const res = await request(testApp)
        .post("/api/assets/00000000-0000-0000-0000-000000000000/status")
        .set(h())
        .send({ status: "maintenance" });

      expect(res.status).toBe(404);
    });
  });

  // ─── Status history ───────────────────────────────────────────────────────────

  describe("GET /api/assets/:id/status-history", () => {
    it("records history entries for each transition", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "maintenance", reason: "Check 1" });

      await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "available", reason: "Done" });

      const res = await request(testApp)
        .get(`/api/assets/${asset.id}/status-history`)
        .set(h());

      expect(res.status).toBe(200);
      const history = resBody<ApiResponse>(res).data as unknown as unknown[];
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Archive / restore ────────────────────────────────────────────────────────

  describe("POST /api/assets/:id/archive  and  /restore", () => {
    it("archives an asset", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/archive`)
        .set(h());

      expect(res.status).toBe(200);
    });

    it("restores an archived asset", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      await request(testApp).post(`/api/assets/${asset.id}/archive`).set(h());

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/restore`)
        .set(h());

      expect(res.status).toBe(200);
    });

    it("prevents status change on archived asset", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        assetType: "bike",
        status: "available",
      });

      await request(testApp).post(`/api/assets/${asset.id}/archive`).set(h());

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "maintenance" });

      expect(res.status).toBe(422);
    });
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────────

  describe("tenant isolation", () => {
    it("cannot read assets from another company", async () => {
      const tenantB = await createTestTenant({ companyName: "Company B" });
      const userB = await createTestUser({
        email: `user-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      await assignRole(userB.id, tenantB.company.id, "owner");

      const assetA = await createTestAsset(
        tenant.company.id,
        tenant.branch.id,
        { assetType: "bike" },
      );

      const res = await request(testApp)
        .get(`/api/assets/${assetA.id}`)
        .set(authHeaders(userB.token, tenantB.company.id));

      expect(res.status).toBe(404);
    });
  });
});
