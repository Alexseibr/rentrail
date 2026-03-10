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
  authHeaders,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

describe("Invoices — integration", () => {
  let platformAdmin: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Invoices Test Co" });
    platformAdmin = await createTestUser({
      email: `invoice-admin-${Date.now()}@test.com`,
      platformRoleCodes: ["platformFinance"],
    });
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h() {
    return authHeaders(platformAdmin.token);
  }

  async function createDraftInvoice(
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const res = await request(testApp)
      .post("/api/platform/billing/invoices")
      .set(h())
      .send({
        companyId: tenant.company.id,
        amount: 5_000,
        notes: "Monthly billing",
        ...overrides,
      });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data as Record<string, unknown>;
  }

  // ─── Invoices — Create ────────────────────────────────────────────────────────

  describe("POST /api/platform/billing/invoices", () => {
    it("creates a draft invoice and returns it with status 201", async () => {
      const dueDate = new Date(Date.now() + 14 * 86_400_000).toISOString();

      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set(h())
        .send({
          companyId: tenant.company.id,
          amount: 9_900,
          currency: "RUB",
          dueDate,
          notes: "First invoice",
        });

      expect(res.status).toBe(201);
      const invoice = resBody<ApiResponse>(res).data;
      expect(invoice).toHaveProperty("id");
      expect(invoice.companyId).toBe(tenant.company.id);
      expect(invoice.amount).toBe(9_900);
      expect(invoice.status).toBe("draft");
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .send({ companyId: tenant.company.id, amount: 0 });

      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-platform user", async () => {
      const ordinary = await createTestUser({
        email: `ordinary-${Date.now()}@test.com`,
      });

      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set(authHeaders(ordinary.token))
        .send({ companyId: tenant.company.id, amount: 100 });

      expect(res.status).toBe(403);
    });

    it("rejects missing companyId with 4xx", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set(h())
        .send({ amount: 500 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects a negative amount with 4xx", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set(h())
        .send({ companyId: tenant.company.id, amount: -1 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Invoices — List ─────────────────────────────────────────────────────────

  describe("GET /api/platform/billing/invoices", () => {
    it("returns a paginated invoice list", async () => {
      await createDraftInvoice();

      const res = await request(testApp)
        .get("/api/platform/billing/invoices")
        .set(h());

      expect(res.status).toBe(200);
      const body = resBody<ApiResponse>(res).data as Record<string, unknown>;
      expect(Array.isArray(body.items)).toBe(true);
      const pagination = body.pagination as Record<string, unknown>;
      expect(typeof pagination.total).toBe("number");
      expect(pagination.total as number).toBeGreaterThanOrEqual(1);
    });

    it("filters by companyId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?companyId=${tenant.company.id}`)
        .set(h());

      expect(res.status).toBe(200);
      const body = resBody<ApiResponse>(res).data as Record<string, unknown>;
      const items = body.items as Array<Record<string, unknown>>;
      expect(items.every((inv) => inv.companyId === tenant.company.id)).toBe(
        true,
      );
    });

    it("filters by status=draft", async () => {
      await createDraftInvoice();

      const res = await request(testApp)
        .get("/api/platform/billing/invoices?status=draft")
        .set(h());

      expect(res.status).toBe(200);
      const body = resBody<ApiResponse>(res).data as Record<string, unknown>;
      const items = body.items as Array<Record<string, unknown>>;
      expect(items.every((inv) => inv.status === "draft")).toBe(true);
    });

    it("rejects an invalid status value with 4xx", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/invoices?status=bad_status")
        .set(h());

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp).get("/api/platform/billing/invoices");

      expect(res.status).toBe(401);
    });
  });

  // ─── Invoices — Get by ID ─────────────────────────────────────────────────────

  describe("GET /api/platform/billing/invoices/:id", () => {
    it("returns the invoice by id", async () => {
      const invoice = await createDraftInvoice();

      const res = await request(testApp)
        .get(`/api/platform/billing/invoices/${invoice.id as string}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(invoice.id);
      expect(resBody<ApiResponse>(res).data.companyId).toBe(tenant.company.id);
    });

    it("returns 404 for an unknown invoice id", async () => {
      const res = await request(testApp)
        .get(
          "/api/platform/billing/invoices/00000000-0000-0000-0000-000000000000",
        )
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── Invoices — Issue ─────────────────────────────────────────────────────────

  describe("POST /api/platform/billing/invoices/:id/issue", () => {
    it("advances invoice from draft → issued", async () => {
      const invoice = await createDraftInvoice();

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("issued");
    });

    it("returns 404 for an unknown invoice id", async () => {
      const res = await request(testApp)
        .post(
          "/api/platform/billing/invoices/00000000-0000-0000-0000-000000000000/issue",
        )
        .set(h());

      expect(res.status).toBe(404);
    });

    it("returns 422 when issuing an already-issued invoice", async () => {
      const invoice = await createDraftInvoice();
      await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());

      expect(res.status).toBe(422);
    });
  });

  // ─── Invoices — Mark Paid ─────────────────────────────────────────────────────

  describe("POST /api/platform/billing/invoices/:id/mark-paid", () => {
    it("advances invoice from issued → paid and records a payment", async () => {
      const invoice = await createDraftInvoice({ amount: 10_000 });
      await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());

      const res = await request(testApp)
        .post(
          `/api/platform/billing/invoices/${invoice.id as string}/mark-paid`,
        )
        .set(h())
        .send({
          amount: 10_000,
          method: "bank_transfer",
          reference: "TXN-001",
        });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("paid");
    });

    it("rejects mark-paid on a draft invoice with 422", async () => {
      const invoice = await createDraftInvoice();

      const res = await request(testApp)
        .post(
          `/api/platform/billing/invoices/${invoice.id as string}/mark-paid`,
        )
        .set(h())
        .send({ amount: 5_000, method: "cash" });

      expect(res.status).toBe(422);
    });

    it("rejects missing payment method with 4xx", async () => {
      const invoice = await createDraftInvoice();
      await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());

      const res = await request(testApp)
        .post(
          `/api/platform/billing/invoices/${invoice.id as string}/mark-paid`,
        )
        .set(h())
        .send({ amount: 5_000 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Invoices — Void ─────────────────────────────────────────────────────────

  describe("POST /api/platform/billing/invoices/:id/void", () => {
    it("voids a draft invoice", async () => {
      const invoice = await createDraftInvoice();

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/void`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("void");
    });

    it("voids an issued invoice", async () => {
      const invoice = await createDraftInvoice();
      await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/void`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("void");
    });

    it("returns 422 when voiding an already-paid invoice", async () => {
      const invoice = await createDraftInvoice({ amount: 3_000 });
      await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/issue`)
        .set(h());
      await request(testApp)
        .post(
          `/api/platform/billing/invoices/${invoice.id as string}/mark-paid`,
        )
        .set(h())
        .send({ amount: 3_000, method: "card" });

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoice.id as string}/void`)
        .set(h());

      expect(res.status).toBe(422);
    });

    it("returns 404 for an unknown invoice id", async () => {
      const res = await request(testApp)
        .post(
          "/api/platform/billing/invoices/00000000-0000-0000-0000-000000000000/void",
        )
        .set(h());

      expect(res.status).toBe(404);
    });
  });
});
