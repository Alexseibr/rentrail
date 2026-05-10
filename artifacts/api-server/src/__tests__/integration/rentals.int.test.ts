import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db, rentals } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  testApp,
  acquireTestLock,
  cleanDatabase,
  clearRolesCache,
  seedRolesAndPermissions,
  createTestUser,
  createTestTenant,
  createTestClient,
  createTestAsset,
  assignRole,
  authHeaders,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

async function forceRentalStatus(rentalId: string, status: string) {
  await db
    .update(rentals)
    .set({ status: status as typeof rentals.$inferInsert.status })
    .where(eq(rentals.id, rentalId));
}

describe("Rentals — integration", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let client: Awaited<ReturnType<typeof createTestClient>>;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Rentals Int Co" });
    admin = await createTestUser({
      email: `rentals-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin", tenant.branch.id);
    client = await createTestClient(tenant.company.id);
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h() {
    return authHeaders(admin.token, tenant.company.id, tenant.branch.id);
  }

  async function freshAsset(status = "available") {
    return createTestAsset(tenant.company.id, tenant.branch.id, {
      stationId: tenant.station.id,
      status,
    });
  }

  async function createRental(
    assetId?: string,
  ): Promise<Record<string, unknown>> {
    const asset = assetId ? { id: assetId } : await freshAsset();
    const res = await request(testApp).post("/api/rentals").set(h()).send({
      clientId: client.id,
      assetId: asset.id,
      branchId: tenant.branch.id,
    });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data as Record<string, unknown>;
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  describe("GET /api/rentals", () => {
    it("returns a list for the company", async () => {
      const res = await request(testApp).get("/api/rentals").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .get("/api/rentals")
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("filters by status — only matching rentals are returned", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "active");

      const res = await request(testApp)
        .get("/api/rentals?status=active")
        .set(h());

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data as unknown as Array<{
        status: string;
      }>;
      expect(data.every((r) => r.status === "active")).toBe(true);
    });
  });

  // ─── Create ───────────────────────────────────────────────────────────────────

  describe("POST /api/rentals", () => {
    it("creates a rental in draft status", async () => {
      const asset = await freshAsset();

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({
          clientId: client.id,
          assetId: asset.id,
          branchId: tenant.branch.id,
        });

      expect(res.status).toBe(201);
      const rental = resBody<ApiResponse>(res).data;
      expect(rental.status).toBe("draft");
      expect(rental).toHaveProperty("id");
      expect(rental.clientId).toBe(client.id);
    });

    it("returns 401 without authentication", async () => {
      const asset = await freshAsset();
      const res = await request(testApp)
        .post("/api/rentals")
        .set("x-company-id", tenant.company.id)
        .send({ clientId: client.id, assetId: asset.id });

      expect(res.status).toBe(401);
    });

    it("returns 403 for a user with no company role", async () => {
      const stranger = await createTestUser({
        email: `stranger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      const asset = await freshAsset();

      const res = await request(testApp)
        .post("/api/rentals")
        .set(authHeaders(stranger.token, tenant.company.id))
        .send({ clientId: client.id, assetId: asset.id });

      expect(res.status).toBe(403);
    });

    it("rejects missing clientId with 4xx", async () => {
      const asset = await freshAsset();
      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ assetId: asset.id, branchId: tenant.branch.id });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects missing assetId with 4xx", async () => {
      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client.id, branchId: tenant.branch.id });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects a rental for an asset in maintenance", async () => {
      const asset = await freshAsset("maintenance");

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client.id, assetId: asset.id });

      expect(res.status).toBe(422);
    });

    it("rejects a second rental for an asset already in draft", async () => {
      const asset = await freshAsset();
      await createRental(asset.id);

      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const client2 = await createTestClient(tenant.company.id, {
        phone: `+199${suffix.replace(/\D/g, "").slice(0, 9).padEnd(9, "1")}`,
        email: `c2-${suffix}@test.com`,
      });

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client2.id, assetId: asset.id });

      expect(res.status).toBe(409);
    });
  });

  // ─── Get by ID ────────────────────────────────────────────────────────────────

  describe("GET /api/rentals/:id", () => {
    it("returns the rental by id", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .get(`/api/rentals/${rental.id as string}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(rental.id);
    });

    it("returns 404 for an unknown id", async () => {
      const res = await request(testApp)
        .get("/api/rentals/00000000-0000-0000-0000-000000000000")
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── Approve ──────────────────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/approve", () => {
    it("advances draft → awaiting_payment", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/approve`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("awaiting_payment");
    });

    it("returns 422 when approving a completed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({});

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/approve`)
        .set(h());

      expect(res.status).toBe(422);
    });

    it("returns 404 for an unknown id", async () => {
      const res = await request(testApp)
        .post("/api/rentals/00000000-0000-0000-0000-000000000000/approve")
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── Start ────────────────────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/start", () => {
    it("advances awaiting_pickup → active and marks asset as rented", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("rented");
    });

    it("returns 422 when starting from draft status", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      expect(res.status).toBe(422);
    });
  });

  // ─── Extend ───────────────────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/extend", () => {
    it("extends an active rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const futureDate = new Date(Date.now() + 7 * 86400_000).toISOString();
      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: futureDate, reason: "Client requested" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("extended");
    });

    it("returns 422 when extending a draft rental", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: new Date(Date.now() + 86400_000).toISOString() });

      expect(res.status).toBe(422);
    });
  });

  // ─── Return ───────────────────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/return", () => {
    it("completes an active rental and frees the asset", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({
          returnedToStationId: tenant.station.id,
          assetReturnStatus: "available",
        });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("completed");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });

    it("returns 422 when returning a draft rental", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({});

      expect(res.status).toBe(422);
    });

    it("rejects return to station from a different company", async () => {
      const otherTenant = await createTestTenant({ companyName: "Other Co" });
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ returnedToStationId: otherTenant.station.id });

      expect(res.status).toBe(400);
    });
  });

  // ─── Cancel ───────────────────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/cancel", () => {
    it("cancels a draft rental", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({ reason: "Changed mind" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
    });

    it("cancels an awaiting_payment rental", async () => {
      const rental = await createRental();
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/approve`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({});

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
    });

    it("canceling an active rental returns the asset to available", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({ reason: "Emergency" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });

    it("returns 422 when canceling a completed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({});

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({});

      expect(res.status).toBe(422);
    });
  });

  // ─── Status history ───────────────────────────────────────────────────────────

  describe("GET /api/rentals/:id/status-history", () => {
    it("records history entries for each transition", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({});

      const res = await request(testApp)
        .get(`/api/rentals/${rental.id as string}/status-history`)
        .set(h());

      expect(res.status).toBe(200);
      const history = resBody<ApiResponse>(res).data as unknown as unknown[];
      const statuses = (history as Array<{ toStatus: string }>).map(
        (e) => e.toStatus,
      );
      expect(statuses).toContain("active");
      expect(statuses).toContain("completed");
    });

    it("returns empty array for an unknown rental id", async () => {
      const res = await request(testApp)
        .get("/api/rentals/00000000-0000-0000-0000-000000000000/status-history")
        .set(h());

      expect(res.status).toBe(200);
      expect(
        (resBody<ApiResponse>(res).data as unknown as unknown[]).length,
      ).toBe(0);
    });
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────────

  describe("tenant isolation", () => {
    it("cannot read a rental belonging to another company", async () => {
      const tenantB = await createTestTenant({ companyName: "Isolation Co B" });
      const userB = await createTestUser({
        email: `user-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      await assignRole(userB.id, tenantB.company.id, "admin");

      const rental = await createRental();

      const readRes = await request(testApp)
        .get(`/api/rentals/${rental.id as string}`)
        .set(authHeaders(userB.token, tenantB.company.id));

      expect(readRes.status).toBe(404);
    });
  });
});
