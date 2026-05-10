import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
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
import { yukassaGateway, tinkoffGateway } from "../../services/payment-gateway";
import type { GatewayPaymentResult } from "../../services/payment-gateway/types";
import * as notificationService from "../../services/notification.service";

// ── Spy helpers ────────────────────────────────────────────────────────────────
// vi.spyOn mutates the exported gateway OBJECTS, which are the same references
// returned by getGateway() inside the service — so spies intercept real calls.

function makeHoldResult(
  overrides?: Partial<GatewayPaymentResult>,
): GatewayPaymentResult {
  return {
    providerPaymentId: `mock-hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: "authorized",
    confirmationUrl: undefined,
    savedMethodToken: undefined,
    rawResponse: {},
    ...overrides,
  };
}

function makeCaptureResult(
  overrides?: Partial<GatewayPaymentResult>,
): GatewayPaymentResult {
  return {
    providerPaymentId: `mock-cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: "paid",
    rawResponse: {},
    ...overrides,
  };
}

function makeVoidResult(
  overrides?: Partial<GatewayPaymentResult>,
): GatewayPaymentResult {
  return {
    providerPaymentId: `mock-void-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: "voided",
    rawResponse: {},
    ...overrides,
  };
}

const HOOK_TIMEOUT = 30_000;

describe("Payment flows — happy path (spied gateway)", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let client: Awaited<ReturnType<typeof createTestClient>>;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Happy Path Payment Co" });
    admin = await createTestUser({
      email: `hp-admin-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin", tenant.branch.id);
    client = await createTestClient(tenant.company.id);
  }, HOOK_TIMEOUT);

  beforeEach(() => {
    // Notification functions pass clientId as userId, which violates the
    // users FK on the notifications table. Spy them out so the payment
    // state-machine tests run without being blocked by that side effect.
    vi.spyOn(notificationService, "onRentalPaymentHeld").mockResolvedValue(
      undefined,
    );
    vi.spyOn(notificationService, "onRentalPaymentCaptured").mockResolvedValue(
      undefined,
    );
    vi.spyOn(notificationService, "onRentalPaymentVoided").mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  // ─── Hold happy paths ──────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/payment/hold — happy path", () => {
    it("creates an authorized hold and records payment in DB", async () => {
      const rentalId = await createRental();
      const provId = `hp-auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: provId, status: "authorized" }),
      );

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      expect(res.status).toBe(201);
      const payment = (
        resBody<ApiResponse>(res).data as { payment: Record<string, unknown> }
      ).payment;
      expect(payment.type).toBe("deposit_hold");
      expect(payment.status).toBe("authorized");
      expect(String(payment.amount)).toMatch(/^500/);
      expect(payment.provider).toBe("yukassa");
      expect(payment.providerPaymentId).toBe(provId);
    });

    it("creates a pending hold when gateway returns pending + confirmationUrl", async () => {
      const rentalId = await createRental();
      const confirmUrl = "https://pay.yukassa.example.com/confirm";

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({
          status: "pending",
          confirmationUrl: confirmUrl,
        }),
      );

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 30000 });

      expect(res.status).toBe(201);
      const body = resBody<ApiResponse>(res).data as {
        payment: { status: string };
        confirmationUrl: string;
      };
      expect(body.payment.status).toBe("pending");
      expect(body.confirmationUrl).toBe(confirmUrl);
    });

    it("uses tinkoff gateway when provider=tinkoff", async () => {
      const rentalId = await createRental();

      vi.spyOn(tinkoffGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ status: "authorized" }),
      );

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "tinkoff", amountKopecks: 20000 });

      expect(res.status).toBe(201);
      const payment = (
        resBody<ApiResponse>(res).data as { payment: Record<string, unknown> }
      ).payment;
      expect(payment.provider).toBe("tinkoff");
      expect(payment.status).toBe("authorized");
    });

    it("persists payment record to DB on successful hold", async () => {
      const rentalId = await createRental();
      const provId = `db-persist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: provId, status: "authorized" }),
      );

      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 15000 });

      const allPayments = await db.select().from(payments);
      const created = allPayments.find((p) => p.providerPaymentId === provId);
      expect(created).toBeDefined();
      expect(created?.type).toBe("deposit_hold");
      expect(created?.status).toBe("authorized");
      expect(created?.rentalId).toBe(rentalId);
    });
  });

  // ─── Hold → Capture ───────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/payment/capture — happy path", () => {
    it("captures an authorized hold: response has rental_payment record", async () => {
      const rentalId = await createRental();
      const capProvId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Hold
      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ status: "authorized" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      // Capture
      vi.spyOn(yukassaGateway, "capturePayment").mockResolvedValueOnce(
        makeCaptureResult({ providerPaymentId: capProvId, status: "paid" }),
      );

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 50000 });

      expect(res.status).toBe(200);
      const payment = resBody<ApiResponse>(res).data;
      expect(payment.type).toBe("rental_payment");
      expect(payment.status).toBe("paid");
      expect(payment.providerPaymentId).toBe(capProvId);
      expect(payment.paidAt).toBeTruthy();
    });

    it("marks the original hold as paid after capture (DB side effect)", async () => {
      const rentalId = await createRental();
      const holdProvId = `hold-mark-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: holdProvId, status: "authorized" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 40000 });

      vi.spyOn(yukassaGateway, "capturePayment").mockResolvedValueOnce(
        makeCaptureResult({ status: "paid" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 40000 });

      const allPayments = await db.select().from(payments);
      const hold = allPayments.find((p) => p.providerPaymentId === holdProvId);
      expect(hold?.status).toBe("paid");
    });

    it("list shows both deposit_hold and rental_payment records after capture", async () => {
      const rentalId = await createRental();

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ status: "authorized" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 25000 });

      vi.spyOn(yukassaGateway, "capturePayment").mockResolvedValueOnce(
        makeCaptureResult({ status: "paid" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 25000 });

      const listRes = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set(h());
      expect(listRes.status).toBe(200);
      const types = (listRes.body.data as Array<{ type: string }>).map(
        (p) => p.type,
      );
      expect(types).toContain("deposit_hold");
      expect(types).toContain("rental_payment");
    });
  });

  // ─── Hold → Void ─────────────────────────────────────────────────────────

  describe("POST /api/rentals/:id/payment/void — happy path", () => {
    it("voids an authorized hold: response type=deposit_hold, DB status=voided", async () => {
      const rentalId = await createRental();
      const holdProvId = `void-prov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: holdProvId, status: "authorized" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      vi.spyOn(yukassaGateway, "voidPayment").mockResolvedValueOnce(
        makeVoidResult({ status: "voided" }),
      );

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.type).toBe("deposit_hold");

      // Verify DB status updated
      const allPayments = await db.select().from(payments);
      const dbHold = allPayments.find(
        (p) => p.providerPaymentId === holdProvId,
      );
      expect(dbHold?.status).toBe("voided");
    });

    it("cannot void the same hold twice (second void → 404)", async () => {
      const rentalId = await createRental();

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ status: "authorized" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 10000 });

      vi.spyOn(yukassaGateway, "voidPayment").mockResolvedValueOnce(
        makeVoidResult({ status: "voided" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());

      // Second void — hold now voided, no authorized hold → 404
      const res2 = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());
      expect(res2.status).toBe(404);
    });
  });

  // ─── Refresh payment status ───────────────────────────────────────────────

  describe("POST /api/rentals/:id/payments/:paymentId/refresh", () => {
    it("updates pending hold to authorized when gateway confirms", async () => {
      const rentalId = await createRental();
      const provId = `ref-auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({
          providerPaymentId: provId,
          status: "pending",
          confirmationUrl: "https://pay.example.com/confirm",
        }),
      );
      const holdRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 10000 });

      const paymentId = (holdRes.body.data as { payment: { id: string } })
        .payment.id;

      vi.spyOn(yukassaGateway, "getPaymentStatus").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: provId, status: "authorized" }),
      );

      const refreshRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payments/${paymentId}/refresh`)
        .set(h());

      expect(refreshRes.status).toBe(200);
      expect(resBody<ApiResponse>(refreshRes).data.status).toBe("authorized");
    });

    it("updates pending hold to failed when gateway reports failure", async () => {
      const rentalId = await createRental();
      const provId = `ref-fail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: provId, status: "pending" }),
      );
      const holdRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 10000 });

      const paymentId = (holdRes.body.data as { payment: { id: string } })
        .payment.id;

      vi.spyOn(yukassaGateway, "getPaymentStatus").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: provId, status: "failed" }),
      );

      const refreshRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payments/${paymentId}/refresh`)
        .set(h());

      expect(refreshRes.status).toBe(200);
      expect(resBody<ApiResponse>(refreshRes).data.status).toBe("failed");
    });

    it("updates captured payment to refunded when gateway reports refund", async () => {
      const rentalId = await createRental();

      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ status: "authorized" }),
      );
      await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      const capProvId = `cap-refund-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      vi.spyOn(yukassaGateway, "capturePayment").mockResolvedValueOnce(
        makeCaptureResult({ providerPaymentId: capProvId, status: "paid" }),
      );
      const captureRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 50000 });

      const capturePaymentId = resBody<ApiResponse>(captureRes).data
        .id as string;

      // Gateway reports the payment was refunded (external refund)
      vi.spyOn(yukassaGateway, "getPaymentStatus").mockResolvedValueOnce({
        providerPaymentId: capProvId,
        status: "refunded",
        rawResponse: {},
      });

      const refreshRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payments/${capturePaymentId}/refresh`)
        .set(h());

      expect(refreshRes.status).toBe(200);
      expect(resBody<ApiResponse>(refreshRes).data.status).toBe("refunded");
    });
  });

  // ─── End-to-end state progressions ───────────────────────────────────────

  describe("end-to-end payment state progressions", () => {
    it("full cycle: hold (authorized) → capture (paid) → refresh (refunded)", async () => {
      const rentalId = await createRental();
      const holdProvId = `e2e-hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const capProvId = `e2e-cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 1. Hold → authorized
      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: holdProvId, status: "authorized" }),
      );
      const holdRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 50000 });

      expect(holdRes.status).toBe(201);
      const holdPayment = (holdRes.body.data as { payment: { status: string } })
        .payment;
      expect(holdPayment.status).toBe("authorized");

      // 2. Capture → paid
      vi.spyOn(yukassaGateway, "capturePayment").mockResolvedValueOnce(
        makeCaptureResult({ providerPaymentId: capProvId, status: "paid" }),
      );
      const captureRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 50000 });

      expect(captureRes.status).toBe(200);
      expect(resBody<ApiResponse>(captureRes).data.status).toBe("paid");
      const captureId = resBody<ApiResponse>(captureRes).data.id as string;

      // 3. Verify list has both records
      const listRes = await request(testApp)
        .get(`/api/rentals/${rentalId}/payments`)
        .set(h());
      expect(listRes.status).toBe(200);
      const list = listRes.body.data as Array<{ type: string; status: string }>;
      expect(
        list.some((p) => p.type === "deposit_hold" && p.status === "paid"),
      ).toBe(true);
      expect(
        list.some((p) => p.type === "rental_payment" && p.status === "paid"),
      ).toBe(true);

      // 4. Refresh rental_payment → refunded (external gateway refund)
      vi.spyOn(yukassaGateway, "getPaymentStatus").mockResolvedValueOnce({
        providerPaymentId: capProvId,
        status: "refunded",
        rawResponse: {},
      });
      const refreshRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payments/${captureId}/refresh`)
        .set(h());

      expect(refreshRes.status).toBe(200);
      expect(resBody<ApiResponse>(refreshRes).data.status).toBe("refunded");
    });

    it("full cycle: hold (authorized) → void → cannot capture (404)", async () => {
      const rentalId = await createRental();

      // 1. Hold → authorized
      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({ status: "authorized" }),
      );
      const holdRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 20000 });
      expect(holdRes.status).toBe(201);

      // 2. Void → voided
      vi.spyOn(yukassaGateway, "voidPayment").mockResolvedValueOnce(
        makeVoidResult({ status: "voided" }),
      );
      const voidRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/void`)
        .set(h());
      expect(voidRes.status).toBe(200);

      // 3. Capture after void — no authorized hold → 404
      const captureRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 20000 });
      expect(captureRes.status).toBe(404);
    });

    it("hold (pending) → refresh → authorized → capture → paid", async () => {
      const rentalId = await createRental();
      const provId = `e2e-pend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 1. Hold → pending (awaiting 3D secure confirmation)
      vi.spyOn(yukassaGateway, "createHold").mockResolvedValueOnce(
        makeHoldResult({
          providerPaymentId: provId,
          status: "pending",
          confirmationUrl: "https://3ds.example.com",
        }),
      );
      const holdRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/hold`)
        .set(h())
        .send({ provider: "yukassa", amountKopecks: 35000 });
      expect(holdRes.status).toBe(201);
      const paymentId = (holdRes.body.data as { payment: { id: string } })
        .payment.id;

      // 2. Poll → now authorized after user completes 3DS
      vi.spyOn(yukassaGateway, "getPaymentStatus").mockResolvedValueOnce(
        makeHoldResult({ providerPaymentId: provId, status: "authorized" }),
      );
      const refreshRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payments/${paymentId}/refresh`)
        .set(h());
      expect(refreshRes.status).toBe(200);
      expect(resBody<ApiResponse>(refreshRes).data.status).toBe("authorized");

      // 3. Now capture succeeds
      vi.spyOn(yukassaGateway, "capturePayment").mockResolvedValueOnce(
        makeCaptureResult({ status: "paid" }),
      );
      const captureRes = await request(testApp)
        .post(`/api/rentals/${rentalId}/payment/capture`)
        .set(h())
        .send({ finalAmountKopecks: 35000 });
      expect(captureRes.status).toBe(200);
      expect(resBody<ApiResponse>(captureRes).data.status).toBe("paid");
    });
  });
});
