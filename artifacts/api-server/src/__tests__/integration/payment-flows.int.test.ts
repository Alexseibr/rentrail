import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db, payments } from "@workspace/db";
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

describe("Payment flows — integration", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let client: Awaited<ReturnType<typeof createTestClient>>;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Payments Int Co" });
    admin = await createTestUser({
      email: `payments-admin-${Date.now()}@test.com`,
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

  async function createRental(): Promise<string> {
    const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
      stationId: tenant.station.id,
      status: "available",
    });
    const res = await request(testApp).post("/api/rentals").set(h()).send({
      clientId: client.id,
      assetId: asset.id,
      branchId: tenant.branch.id,
    });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data.id as string;
  }

  // ─── GET /rentals/:id/payments ─────────────────────────────────────────────

  describe("GET /api/rentals/:id/payments", () => {
    it("returns an empty list for a rental with no payments", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
      expect(
        (resBody<ApiResponse>(res).data as unknown as unknown[]).length,
      ).toBe(0);
    });

    it("returns payment records inserted directly into DB", async () => {
      const rentalId = await createRental();

      await db.insert(payments).values({
        companyId: tenant.company.id,
        branchId: tenant.branch.id,
        clientId: client.id,
        rentalId,
        type: "deposit_hold",
        status: "pending",
        amount: "500.00",
        currency: "RUB",
        provider: "yukassa",
        providerPaymentId: `test-prov-${Date.now()}`,
      });

      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set(h());

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data as unknown as Array<{
        rentalId: string;
        type: string;
      }>;
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].rentalId).toBe(rentalId);
      expect(data[0].type).toBe("deposit_hold");
    });

    it("returns 401 without authentication", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("returns 403 for a user with no company role", async () => {
      const stranger = await createTestUser({
        email: `stranger-pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      const rentalId = await createRental();
      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set(authHeaders(stranger.token, tenant.company.id));

      expect(res.status).toBe(403);
    });

    it("does not expose payments from another company", async () => {
      const tenantB = await createTestTenant({
        companyName: "Payments Isolation Co B",
      });
      const userB = await createTestUser({
        email: `pay-iso-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      await assignRole(userB.id, tenantB.company.id, "admin");

      const rentalId = await createRental();

      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set(authHeaders(userB.token, tenantB.company.id));

      // Route filters by companyId — cross-tenant access yields 404 (rental not found
      // in company B's scope) or an empty list depending on implementation.
      const isIsolated =
        res.status === 404 ||
        (res.status === 200 && (res.body?.data as unknown[])?.length === 0);
      expect(isIsolated).toBe(true);
    });
  });

  // ─── POST /rentals/:id/payment/hold ──────────────────────────────────────────

  describe("POST /api/rentals/:id/payment/hold", () => {
    it("returns 401 without authentication", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set("x-company-id", tenant.company.id)
        .send({
          provider: "yukassa",
          amountKopecks: 50000,
        });

      expect(res.status).toBe(401);
    });

    it("returns 400 for an unknown payment provider", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({
          provider: "fake_gateway",
          amountKopecks: 50000,
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 4xx for missing provider field", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ amountKopecks: 50000 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 4xx for missing amountKopecks", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 4xx for negative amountKopecks", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: -100 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 404 for an unknown rental id", async () => {
      const res = await request(testApp)
        .post("/api/rentals/00000000-0000-0000-0000-000000000000/payment/hold")
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects duplicate hold when an authorized hold already exists", async () => {
      const rentalId = await createRental();

      await db.insert(payments).values({
        companyId: tenant.company.id,
        branchId: tenant.branch.id,
        clientId: client.id,
        rentalId,
        type: "deposit_hold",
        status: "authorized",
        amount: "500.00",
        currency: "RUB",
        provider: "yukassa",
        providerPaymentId: `dup-${Date.now()}`,
      });

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      expect(res.status).toBe(409);
    });
  });

  // ─── POST /rentals/:id/payment/capture ───────────────────────────────────────

  describe("POST /api/rentals/:id/payment/capture", () => {
    it("returns 401 without authentication", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set("x-company-id", tenant.company.id)
        .send({ finalAmountKopecks: 50000 });

      expect(res.status).toBe(401);
    });

    it("returns 404 when no authorized hold exists", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 50000 });

      expect(res.status).toBe(404);
    });

    it("returns 4xx for missing finalAmountKopecks", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 404 for an unknown rental id", async () => {
      const res = await request(testApp)
        .post(
          "/api/rentals/00000000-0000-0000-0000-000000000000/payment/capture",
        )
        .set(h())
        .send({ finalAmountKopecks: 50000 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 404 when the hold exists but is not authorized (pending)", async () => {
      const rentalId = await createRental();

      await db.insert(payments).values({
        companyId: tenant.company.id,
        branchId: tenant.branch.id,
        clientId: client.id,
        rentalId,
        type: "deposit_hold",
        status: "pending",
        amount: "500.00",
        currency: "RUB",
        provider: "yukassa",
        providerPaymentId: `pending-${Date.now()}`,
      });

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 50000 });

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /rentals/:id/payment/void ──────────────────────────────────────────

  describe("POST /api/rentals/:id/payment/void", () => {
    it("returns 401 without authentication", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("returns 404 when no authorized hold exists", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());

      expect(res.status).toBe(404);
    });

    it("returns 404 for an unknown rental id", async () => {
      const res = await request(testApp)
        .post("/api/rentals/00000000-0000-0000-0000-000000000000/payment/void")
        .set(h());

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 404 when hold is in voided state (not authorized)", async () => {
      const rentalId = await createRental();

      await db.insert(payments).values({
        companyId: tenant.company.id,
        branchId: tenant.branch.id,
        clientId: client.id,
        rentalId,
        type: "deposit_hold",
        status: "voided",
        amount: "300.00",
        currency: "RUB",
        provider: "yukassa",
        providerPaymentId: `voided-${Date.now()}`,
      });

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /rentals/:id/payments/:paymentId/refresh ───────────────────────────

  describe("POST /api/rentals/:id/payments/:paymentId/refresh", () => {
    it("returns 401 without authentication", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(
          `/api/rentals/${rentalId}/payments/00000000-0000-0000-0000-000000000000/refresh`,
        )
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-existent payment id", async () => {
      const rentalId = await createRental();
      const res = await request(testApp)
        .post(
          `/api/rentals/${rentalId}/payments/00000000-0000-0000-0000-000000000000/refresh`,
        )
        .set(h());

      expect(res.status).toBe(404);
    });

    it("returns 4xx for a payment without provider data", async () => {
      const rentalId = await createRental();

      const [payment] = await db
        .insert(payments)
        .values({
          companyId: tenant.company.id,
          branchId: tenant.branch.id,
          clientId: client.id,
          rentalId,
          type: "deposit_hold",
          status: "pending",
          amount: "200.00",
          currency: "RUB",
        })
        .returning();

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payments/${payment.id}/refresh`)
        .set(h());

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Payment list across multiple rentals ─────────────────────────────────────

  describe("payment isolation between rentals", () => {
    it("returns payments only for the specified rental, not others", async () => {
      const rentalA = await createRental();
      const rentalB = await createRental();

      const providerIdA = `iso-a-${Date.now()}`;
      const providerIdB = `iso-b-${Date.now()}`;

      await db.insert(payments).values([
        {
          companyId: tenant.company.id,
          branchId: tenant.branch.id,
          clientId: client.id,
          rentalId: rentalA,
          type: "deposit_hold",
          status: "pending",
          amount: "100.00",
          currency: "RUB",
          provider: "yukassa",
          providerPaymentId: providerIdA,
        },
        {
          companyId: tenant.company.id,
          branchId: tenant.branch.id,
          clientId: client.id,
          rentalId: rentalB,
          type: "deposit_hold",
          status: "pending",
          amount: "200.00",
          currency: "RUB",
          provider: "tinkoff",
          providerPaymentId: providerIdB,
        },
      ]);

      const resA = await request(testApp)
        .get(`/api/rentals/${rentalA}/payments`)
        .set(h());

      expect(resA.status).toBe(200);
      const dataA = resBody<ApiResponse>(resA).data as unknown as Array<{
        rentalId: string;
        providerPaymentId: string;
      }>;
      expect(dataA.every((p) => p.rentalId === rentalA)).toBe(true);
      expect(dataA.some((p) => p.providerPaymentId === providerIdA)).toBe(true);
      expect(dataA.some((p) => p.providerPaymentId === providerIdB)).toBe(
        false,
      );
    });
  });

  // ─── Status machine: cancelled rental has no hold to void ─────────────────────

  describe("payment guard: cancelled rental", () => {
    it("cannot void a hold on a cancelled rental — no authorized hold exists", async () => {
      const rentalId = await createRental();
      await request(testApp)
        .post(`/api/rentals/${rentalId}/cancel`)
        .set(h())
        .send({ reason: "Test cancel" });

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());

      expect(res.status).toBe(404);
    });
  });
});
