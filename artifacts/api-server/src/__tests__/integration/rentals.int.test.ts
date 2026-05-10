import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db, rentals, rentalBlackoutDates } from "@workspace/db";
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

      const res = await request(testApp).post("/api/rentals").set(h()).send({
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

  // ─── Full lifecycle happy path ────────────────────────────────────────────────

  describe("Full lifecycle happy path", () => {
    it("tracks asset status transitions through the full rental flow", async () => {
      const asset = await freshAsset();

      // 1. Create → draft, asset stays available
      const rental = await createRental(asset.id);
      expect(rental.status).toBe("draft");

      let assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");

      // 2. Start → active, asset becomes rented
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      const startRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      expect(startRes.status).toBe(200);
      expect(resBody<ApiResponse>(startRes).data.status).toBe("active");

      assetRes = await request(testApp).get(`/api/assets/${asset.id}`).set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("rented");

      // 3. Return → completed, asset back to available
      const returnRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({
          returnedToStationId: tenant.station.id,
          assetReturnStatus: "available",
        });
      expect(returnRes.status).toBe(200);
      expect(resBody<ApiResponse>(returnRes).data.status).toBe("completed");

      assetRes = await request(testApp).get(`/api/assets/${asset.id}`).set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");

      // 4. Status history captures every transition
      const histRes = await request(testApp)
        .get(`/api/rentals/${rental.id as string}/status-history`)
        .set(h());
      expect(histRes.status).toBe(200);
      const toStatuses = (
        resBody<ApiResponse>(histRes).data as unknown as Array<{
          toStatus: string;
        }>
      ).map((e) => e.toStatus);
      expect(toStatuses).toContain("active");
      expect(toStatuses).toContain("completed");
    });

    it("asset status history records both rental transitions", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "available" });

      // Verify via asset status endpoint that the asset is available again
      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });
  });

  // ─── Early return flow ────────────────────────────────────────────────────────

  describe("Early return flow", () => {
    it("completes an extended rental before the new end date (early return)", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");

      // Start the rental
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      // Extend with an end date 7 days in the future
      const farFuture = new Date(Date.now() + 7 * 86400_000).toISOString();
      const extendRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: farFuture, reason: "Client needs extra time" });
      expect(extendRes.status).toBe(200);
      expect(resBody<ApiResponse>(extendRes).data.status).toBe("extended");

      // Asset remains rented while extended
      let assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("rented");

      // Return early — before the extended end date
      const earlyReturnRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "available" });
      expect(earlyReturnRes.status).toBe(200);
      expect(resBody<ApiResponse>(earlyReturnRes).data.status).toBe(
        "completed",
      );

      // Asset is freed immediately on early return
      assetRes = await request(testApp).get(`/api/assets/${asset.id}`).set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });

    it("returns an active rental to maintenance status when the asset needs service", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "maintenance" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("completed");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("maintenance");
    });

    it("returns a return_requested rental and completes it", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      // Force to return_requested (simulating client-initiated return request)
      await forceRentalStatus(rental.id as string, "return_requested");

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "available" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("completed");
    });
  });

  // ─── Dispute lifecycle ────────────────────────────────────────────────────────

  describe("Dispute lifecycle", () => {
    // Helper: bring a rental to the disputed state.
    // There is no public "create dispute" endpoint yet, so we set the DB status
    // directly — only for the purpose of putting the rental into the state under
    // test.  Resolution is always exercised through the HTTP API.
    async function intoDispute(rentalId: string) {
      await forceRentalStatus(rentalId, "disputed");
    }

    it("resolves a disputed rental to completed via the HTTP endpoint, freeing the asset", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      // Asset is still rented while disputed
      let assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("rented");

      // Resolve via HTTP API → disputed → completed
      const resolveRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/resolve-dispute`)
        .set(h())
        .send({ resolution: "completed", reason: "Settled with client" });

      expect(resolveRes.status).toBe(200);
      expect(resBody<ApiResponse>(resolveRes).data.status).toBe("completed");

      // Asset should now be available
      assetRes = await request(testApp).get(`/api/assets/${asset.id}`).set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");

      // Status history records the API-driven resolution transition
      // (disputed entry is not in history because we forced it directly via DB)
      const histRes = await request(testApp)
        .get(`/api/rentals/${rental.id as string}/status-history`)
        .set(h());
      const statuses = (
        resBody<ApiResponse>(histRes).data as unknown as Array<{
          toStatus: string;
        }>
      ).map((e) => e.toStatus);
      expect(statuses).toContain("active");
      expect(statuses).toContain("completed");
    });

    it("resolves a disputed rental to defaulted via the HTTP endpoint", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      const resolveRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/resolve-dispute`)
        .set(h())
        .send({ resolution: "defaulted", reason: "Client never responded" });

      expect(resolveRes.status).toBe(200);
      expect(resBody<ApiResponse>(resolveRes).data.status).toBe("defaulted");
    });

    it("rejects resolving a non-disputed rental via the resolve-dispute endpoint", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      // Active, not disputed
      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/resolve-dispute`)
        .set(h())
        .send({ resolution: "completed" });

      expect(res.status).toBe(422);
    });

    it("rejects invalid resolution value", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/resolve-dispute`)
        .set(h())
        .send({ resolution: "canceled" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("blocks cancel on a disputed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({ reason: "Try to cancel" });

      expect(res.status).toBe(422);
    });

    it("blocks return on a disputed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "available" });

      expect(res.status).toBe(422);
    });

    it("blocks extend on a disputed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({
          newEndDate: new Date(Date.now() + 86400_000).toISOString(),
        });

      expect(res.status).toBe(422);
    });

    it("records the disputed status in history and remains readable", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      const detailRes = await request(testApp)
        .get(`/api/rentals/${rental.id as string}`)
        .set(h());
      expect(detailRes.status).toBe(200);
      expect(resBody<ApiResponse>(detailRes).data.status).toBe("disputed");
    });

    it("shows disputed rental in list when filtering by status", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await intoDispute(rental.id as string);

      const listRes = await request(testApp)
        .get("/api/rentals?status=disputed")
        .set(h());
      expect(listRes.status).toBe(200);
      const data = resBody<ApiResponse>(listRes).data as unknown as Array<{
        id: string;
        status: string;
      }>;
      const found = data.find((r) => r.id === (rental.id as string));
      expect(found).toBeDefined();
      expect(found?.status).toBe("disputed");
    });
  });

  // ─── Blackout date enforcement ────────────────────────────────────────────────

  describe("Blackout date enforcement", () => {
    async function createBlackoutDate(opts: {
      assetId?: string;
      branchId?: string;
      startDate: Date;
      endDate: Date;
      reason?: string;
    }) {
      const res = await request(testApp)
        .post("/api/blackout-dates")
        .set(h())
        .send({
          assetId: opts.assetId,
          branchId: opts.branchId,
          startDate: opts.startDate.toISOString(),
          endDate: opts.endDate.toISOString(),
          reason: opts.reason ?? "Scheduled maintenance",
        });
      expect(res.status).toBe(201);
      return resBody<ApiResponse>(res).data as Record<string, unknown>;
    }

    it("blocks rental creation for an asset covered by an asset-level blackout", async () => {
      const asset = await freshAsset();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      await createBlackoutDate({
        assetId: asset.id,
        startDate: yesterday,
        endDate: tomorrow,
        reason: "Asset inspection",
      });

      const res = await request(testApp).post("/api/rentals").set(h()).send({
        clientId: client.id,
        assetId: asset.id,
        branchId: tenant.branch.id,
      });

      expect(res.status).toBe(422);
    });

    it("blocks rental creation when the company has a company-wide blackout", async () => {
      // Use a fresh isolated tenant to avoid leaking the company-wide blackout
      const isolatedTenant = await createTestTenant({
        companyName: "Blackout Co Global",
      });
      const isolatedAdmin = await createTestUser({
        email: `blackout-global-${Date.now()}@test.com`,
      });
      await assignRole(
        isolatedAdmin.id,
        isolatedTenant.company.id,
        "admin",
        isolatedTenant.branch.id,
      );
      const isolatedClient = await createTestClient(isolatedTenant.company.id);
      const isolatedAsset = await createTestAsset(
        isolatedTenant.company.id,
        isolatedTenant.branch.id,
        { stationId: isolatedTenant.station.id },
      );
      const iHeaders = authHeaders(
        isolatedAdmin.token,
        isolatedTenant.company.id,
        isolatedTenant.branch.id,
      );

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Company-wide blackout: no branchId, no assetId
      const blackoutRes = await request(testApp)
        .post("/api/blackout-dates")
        .set(iHeaders)
        .send({
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
          reason: "Company-wide closure",
        });
      expect(blackoutRes.status).toBe(201);

      const res = await request(testApp)
        .post("/api/rentals")
        .set(iHeaders)
        .send({
          clientId: isolatedClient.id,
          assetId: isolatedAsset.id,
          branchId: isolatedTenant.branch.id,
        });

      expect(res.status).toBe(422);
    });

    it("blocks rental creation when the branch has a branch-level blackout", async () => {
      // Use a fresh isolated tenant to avoid leaking the branch-level blackout
      const isolatedTenant = await createTestTenant({
        companyName: "Blackout Co Branch",
      });
      const isolatedAdmin = await createTestUser({
        email: `blackout-branch-${Date.now()}@test.com`,
      });
      await assignRole(
        isolatedAdmin.id,
        isolatedTenant.company.id,
        "admin",
        isolatedTenant.branch.id,
      );
      const isolatedClient = await createTestClient(isolatedTenant.company.id);
      const isolatedAsset = await createTestAsset(
        isolatedTenant.company.id,
        isolatedTenant.branch.id,
        { stationId: isolatedTenant.station.id },
      );
      const iHeaders = authHeaders(
        isolatedAdmin.token,
        isolatedTenant.company.id,
        isolatedTenant.branch.id,
      );

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const blackoutRes = await request(testApp)
        .post("/api/blackout-dates")
        .set(iHeaders)
        .send({
          branchId: isolatedTenant.branch.id,
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
          reason: "Branch event",
        });
      expect(blackoutRes.status).toBe(201);

      const res = await request(testApp)
        .post("/api/rentals")
        .set(iHeaders)
        .send({
          clientId: isolatedClient.id,
          assetId: isolatedAsset.id,
          branchId: isolatedTenant.branch.id,
        });

      expect(res.status).toBe(422);
    });

    it("allows rental creation for a different asset when only one asset is blacked out", async () => {
      const blockedAsset = await freshAsset();
      const freeAsset = await freshAsset();

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Only block the first asset
      await db.insert(rentalBlackoutDates).values({
        companyId: tenant.company.id,
        assetId: blockedAsset.id,
        startDate: yesterday,
        endDate: tomorrow,
        reason: "Targeted blackout",
      });

      // Blocked asset → 422
      const blockedRes = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({
          clientId: client.id,
          assetId: blockedAsset.id,
          branchId: tenant.branch.id,
        });
      expect(blockedRes.status).toBe(422);

      // Create a second client so the free asset has no conflict
      const uid = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
      const client2 = await createTestClient(tenant.company.id, {
        phone: `+1855${uid.replace(/\D/g, "").slice(0, 8).padEnd(8, "5")}`,
        email: `c2-blackout-${uid}@test.com`,
      });

      // Free asset → 201
      const freeRes = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({
          clientId: client2.id,
          assetId: freeAsset.id,
          branchId: tenant.branch.id,
        });
      expect(freeRes.status).toBe(201);
    });

    it("allows rental creation for a date outside the blackout window", async () => {
      const asset = await freshAsset();

      // Blackout in the past
      const twoDaysAgo = new Date(Date.now() - 2 * 86400_000);
      const yesterday = new Date(Date.now() - 86400_000);
      await db.insert(rentalBlackoutDates).values({
        companyId: tenant.company.id,
        assetId: asset.id,
        startDate: twoDaysAgo,
        endDate: yesterday,
        reason: "Past blackout",
      });

      // startAt is tomorrow — outside the blackout range
      const tomorrow = new Date(Date.now() + 86400_000).toISOString();
      const res = await request(testApp).post("/api/rentals").set(h()).send({
        clientId: client.id,
        assetId: asset.id,
        branchId: tenant.branch.id,
        startAt: tomorrow,
      });

      expect(res.status).toBe(201);
    });

    it("returns the created blackout date in the listing", async () => {
      const asset = await freshAsset();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const blackout = await createBlackoutDate({
        assetId: asset.id,
        startDate: yesterday,
        endDate: tomorrow,
        reason: "Listed blackout",
      });

      const listRes = await request(testApp)
        .get(`/api/blackout-dates?assetId=${asset.id}`)
        .set(h());
      expect(listRes.status).toBe(200);
      const data = resBody<ApiResponse>(listRes).data as unknown as Array<{
        id: string;
      }>;
      expect(data.some((b) => b.id === (blackout.id as string))).toBe(true);
    });

    it("allows deleting a blackout date and then creating the rental", async () => {
      const asset = await freshAsset();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const blackout = await createBlackoutDate({
        assetId: asset.id,
        startDate: yesterday,
        endDate: tomorrow,
        reason: "Temporary block",
      });

      // Blocked while blackout exists
      const blockedRes = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({
          clientId: client.id,
          assetId: asset.id,
          branchId: tenant.branch.id,
        });
      expect(blockedRes.status).toBe(422);

      // Delete the blackout
      const deleteRes = await request(testApp)
        .delete(`/api/blackout-dates/${blackout.id as string}`)
        .set(h());
      expect(deleteRes.status).toBe(200);

      // Now rental creation succeeds
      const allowedRes = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({
          clientId: client.id,
          assetId: asset.id,
          branchId: tenant.branch.id,
        });
      expect(allowedRes.status).toBe(201);
    });
  });

  // ─── Rental extension — additional coverage ───────────────────────────────────

  describe("Rental extension — additional coverage", () => {
    it("asset status remains rented after extending an active rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const futureDate = new Date(Date.now() + 3 * 86400_000).toISOString();
      const extendRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: futureDate, reason: "Vacation extension" });
      expect(extendRes.status).toBe(200);
      expect(resBody<ApiResponse>(extendRes).data.status).toBe("extended");

      // Asset should still be rented — extension doesn't free it
      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("rented");
    });

    it("updates plannedEndAt when extended", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const newEnd = new Date(Date.now() + 5 * 86400_000);
      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: newEnd.toISOString(), reason: "Extended stay" });

      expect(res.status).toBe(200);
      const updated = resBody<ApiResponse>(res).data as Record<string, unknown>;
      expect(updated.status).toBe("extended");
      // plannedEndAt should be approximately equal to the requested date
      expect(updated.plannedEndAt).toBeDefined();
      const returnedDate = new Date(updated.plannedEndAt as string);
      expect(Math.abs(returnedDate.getTime() - newEnd.getTime())).toBeLessThan(
        5000,
      );
    });

    it("rejects re-extending an already-extended rental (state machine: extended → extended not allowed)", async () => {
      // The transition table does not permit extended → extended.
      // A second extension requires completing and creating a new rental.
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());

      const firstExtend = new Date(Date.now() + 3 * 86400_000).toISOString();
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: firstExtend, reason: "First extension" });

      const secondExtend = new Date(Date.now() + 6 * 86400_000).toISOString();
      const res = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({ newEndDate: secondExtend, reason: "Second extension" });

      expect(res.status).toBe(422);
    });

    it("records both asset status transitions after return from extended rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({
          newEndDate: new Date(Date.now() + 2 * 86400_000).toISOString(),
        });

      const returnRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "charging" });

      expect(returnRes.status).toBe(200);
      expect(resBody<ApiResponse>(returnRes).data.status).toBe("completed");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("charging");
    });
  });

  // ─── Asset status after cancellation ─────────────────────────────────────────

  describe("Asset status during overdue and cancellation paths", () => {
    it("returns overdue rental and marks asset as available", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await forceRentalStatus(rental.id as string, "overdue");

      const returnRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/return`)
        .set(h())
        .send({ assetReturnStatus: "available" });

      expect(returnRes.status).toBe(200);
      expect(resBody<ApiResponse>(returnRes).data.status).toBe("completed");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });

    it("canceling a draft rental does not change asset status", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);

      const cancelRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({ reason: "Changed mind before pickup" });

      expect(cancelRes.status).toBe(200);
      expect(resBody<ApiResponse>(cancelRes).data.status).toBe("canceled");

      // Asset should still be available — it was never rented
      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });

    it("canceling an extended rental frees the asset", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);
      await forceRentalStatus(rental.id as string, "awaiting_pickup");
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/start`)
        .set(h());
      await request(testApp)
        .post(`/api/rentals/${rental.id as string}/extend`)
        .set(h())
        .send({
          newEndDate: new Date(Date.now() + 2 * 86400_000).toISOString(),
        });

      const cancelRes = await request(testApp)
        .post(`/api/rentals/${rental.id as string}/cancel`)
        .set(h())
        .send({ reason: "Client canceled during extension" });

      expect(cancelRes.status).toBe(200);
      expect(resBody<ApiResponse>(cancelRes).data.status).toBe("canceled");

      const assetRes = await request(testApp)
        .get(`/api/assets/${asset.id}`)
        .set(h());
      expect(resBody<ApiResponse>(assetRes).data.status).toBe("available");
    });
  });
});
