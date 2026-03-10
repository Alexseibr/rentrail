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

describe("Billing — integration", () => {
  let platformAdmin: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Billing Test Co" });
    platformAdmin = await createTestUser({
      email: `billing-admin-${Date.now()}@test.com`,
      platformRoleCodes: ["platformAdmin"],
    });
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h() {
    return authHeaders(platformAdmin.token);
  }

  // ─── Plans — List ────────────────────────────────────────────────────────────

  describe("GET /api/platform/billing/plans", () => {
    it("returns a list of plans for a platform admin", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans")
        .set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp).get("/api/platform/billing/plans");

      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-platform user", async () => {
      const companyUser = await createTestUser({
        email: `non-platform-${Date.now()}@test.com`,
      });

      const res = await request(testApp)
        .get("/api/platform/billing/plans")
        .set(authHeaders(companyUser.token));

      expect(res.status).toBe(403);
    });
  });

  // ─── Plans — Create ──────────────────────────────────────────────────────────

  describe("POST /api/platform/billing/plans", () => {
    it("creates a plan and returns it with status 201", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Starter Plan ${suffix}`,
          code: `starter-${suffix}`,
          price: 99_00,
          billingInterval: "monthly",
          maxBranches: 3,
          maxAssets: 20,
          maxUsers: 10,
        });

      expect(res.status).toBe(201);
      const plan = resBody<ApiResponse>(res).data;
      expect(plan).toHaveProperty("id");
      expect(plan.price).toBe(99_00);
      expect(plan.billingInterval).toBe("monthly");
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .send({ name: "No-auth Plan", code: "no-auth", price: 0 });

      expect(res.status).toBe(401);
    });

    it("rejects missing required fields with 4xx", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({ name: "Missing price plan" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Plans — Update ──────────────────────────────────────────────────────────

  describe("PATCH /api/platform/billing/plans/:id", () => {
    it("updates a plan's name and price", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Before Update ${suffix}`,
          code: `before-update-${suffix}`,
          price: 50_00,
        });
      expect(createRes.status).toBe(201);
      const plan = resBody<ApiResponse>(createRes).data;

      const patchRes = await request(testApp)
        .patch(`/api/platform/billing/plans/${plan.id as string}`)
        .set(h())
        .send({ name: "After Update", price: 75_00, isActive: true });

      expect(patchRes.status).toBe(200);
      const updated = resBody<ApiResponse>(patchRes).data;
      expect(updated.id).toBe(plan.id);
      expect(updated.name).toBe("After Update");
      expect(updated.price).toBe(75_00);
    });

    it("can deactivate a plan", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Deactivatable ${suffix}`,
          code: `deactivate-${suffix}`,
          price: 10_00,
        });
      const plan = resBody<ApiResponse>(createRes).data;

      const patchRes = await request(testApp)
        .patch(`/api/platform/billing/plans/${plan.id as string}`)
        .set(h())
        .send({ isActive: false });

      expect(patchRes.status).toBe(200);
      expect(resBody<ApiResponse>(patchRes).data.isActive).toBe(false);
    });

    it("returns 404 for an unknown plan id", async () => {
      const res = await request(testApp)
        .patch(
          "/api/platform/billing/plans/00000000-0000-0000-0000-000000000000",
        )
        .set(h())
        .send({ price: 100_00 });

      expect(res.status).toBe(404);
    });
  });

  // ─── Subscriptions — Set plan & list ─────────────────────────────────────────

  describe("POST /api/platform/companies/:id/set-plan", () => {
    it("creates a subscription for a company", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Sub Plan ${suffix}`,
          code: `sub-plan-${suffix}`,
          price: 149_00,
        });
      expect(planRes.status).toBe(201);
      const plan = resBody<ApiResponse>(planRes).data;

      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set(h())
        .send({ planId: plan.id });

      expect(res.status).toBe(201);
      const sub = resBody<ApiResponse>(res).data;
      expect(sub).toHaveProperty("id");
      expect(sub.companyId).toBe(tenant.company.id);
      expect(sub.planId).toBe(plan.id);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .send({ planId: "00000000-0000-0000-0000-000000000000" });

      expect(res.status).toBe(401);
    });

    it("returns 404 when the company does not exist", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Orphan Plan ${suffix}`,
          code: `orphan-${suffix}`,
          price: 0,
        });
      const plan = resBody<ApiResponse>(planRes).data;

      const res = await request(testApp)
        .post(
          "/api/platform/companies/00000000-0000-0000-0000-000000000000/set-plan",
        )
        .set(h())
        .send({ planId: plan.id });

      expect(res.status).toBe(404);
    });
  });

  // ─── Subscriptions — List ────────────────────────────────────────────────────

  describe("GET /api/platform/billing/subscriptions", () => {
    it("returns a paginated list", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions")
        .set(h());

      expect(res.status).toBe(200);
      const body = resBody<ApiResponse>(res).data as Record<string, unknown>;
      expect(Array.isArray(body.items)).toBe(true);
      const pagination = body.pagination as Record<string, unknown>;
      expect(typeof pagination.total).toBe("number");
    });

    it("filters by companyId", async () => {
      const res = await request(testApp)
        .get(
          `/api/platform/billing/subscriptions?companyId=${tenant.company.id}`,
        )
        .set(h());

      expect(res.status).toBe(200);
      const body = resBody<ApiResponse>(res).data as Record<string, unknown>;
      const items = body.items as Array<Record<string, unknown>>;
      expect(items.every((s) => s.companyId === tenant.company.id)).toBe(true);
    });

    it("rejects an invalid status value with 4xx", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions?status=invalid_status")
        .set(h());

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp).get(
        "/api/platform/billing/subscriptions",
      );

      expect(res.status).toBe(401);
    });
  });

  // ─── Subscriptions — Get by ID ───────────────────────────────────────────────

  describe("GET /api/platform/billing/subscriptions/:id", () => {
    it("returns the subscription detail", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Detail Plan ${suffix}`,
          code: `detail-plan-${suffix}`,
          price: 0,
        });
      const plan = resBody<ApiResponse>(planRes).data;

      const setRes = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set(h())
        .send({ planId: plan.id });
      const sub = resBody<ApiResponse>(setRes).data;

      const res = await request(testApp)
        .get(`/api/platform/billing/subscriptions/${sub.id as string}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(sub.id);
    });

    it("returns 404 for an unknown subscription id", async () => {
      const res = await request(testApp)
        .get(
          "/api/platform/billing/subscriptions/00000000-0000-0000-0000-000000000000",
        )
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── Subscriptions — Lifecycle ───────────────────────────────────────────────

  describe("subscription lifecycle (activate → cancel)", () => {
    async function createSubscription() {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tenantForSub = await createTestTenant({
        companyName: `Sub Co ${suffix}`,
      });

      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Lifecycle Plan ${suffix}`,
          code: `lifecycle-${suffix}`,
          price: 199_00,
        });
      const plan = resBody<ApiResponse>(planRes).data;

      const setRes = await request(testApp)
        .post(`/api/platform/companies/${tenantForSub.company.id}/set-plan`)
        .set(h())
        .send({ planId: plan.id });
      expect(setRes.status).toBe(201);
      return resBody<ApiResponse>(setRes).data as Record<string, unknown>;
    }

    it("activates a subscription", async () => {
      const sub = await createSubscription();

      const res = await request(testApp)
        .post(
          `/api/platform/billing/subscriptions/${sub.id as string}/activate`,
        )
        .set(h())
        .send({ reason: "Manual activation by admin" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
    });

    it("marks a subscription as past_due", async () => {
      const sub = await createSubscription();

      await request(testApp)
        .post(
          `/api/platform/billing/subscriptions/${sub.id as string}/activate`,
        )
        .set(h())
        .send({});

      const res = await request(testApp)
        .post(
          `/api/platform/billing/subscriptions/${sub.id as string}/past-due`,
        )
        .set(h())
        .send({ reason: "Payment overdue" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("past_due");
    });

    it("cancels a subscription", async () => {
      const sub = await createSubscription();

      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${sub.id as string}/cancel`)
        .set(h())
        .send({ reason: "Customer request" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
    });

    it("returns 404 for an unknown subscription id on activate", async () => {
      const res = await request(testApp)
        .post(
          "/api/platform/billing/subscriptions/00000000-0000-0000-0000-000000000000/activate",
        )
        .set(h())
        .send({});

      expect(res.status).toBe(404);
    });
  });

  // ─── Subscriptions — Update ───────────────────────────────────────────────────

  describe("PATCH /api/platform/billing/subscriptions/:id", () => {
    it("updates subscription notes and trial end date", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tenantForPatch = await createTestTenant({
        companyName: `Patch Sub Co ${suffix}`,
      });
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set(h())
        .send({
          name: `Patch Plan ${suffix}`,
          code: `patch-plan-${suffix}`,
          price: 0,
        });
      const plan = resBody<ApiResponse>(planRes).data;
      const setRes = await request(testApp)
        .post(`/api/platform/companies/${tenantForPatch.company.id}/set-plan`)
        .set(h())
        .send({ planId: plan.id });
      const sub = resBody<ApiResponse>(setRes).data;

      const futureDate = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const patchRes = await request(testApp)
        .patch(`/api/platform/billing/subscriptions/${sub.id as string}`)
        .set(h())
        .send({ notes: "VIP customer", trialEndsAt: futureDate });

      expect(patchRes.status).toBe(200);
      expect(resBody<ApiResponse>(patchRes).data.notes).toBe("VIP customer");
    });
  });

  // ─── Payments — List ─────────────────────────────────────────────────────────

  describe("GET /api/platform/billing/payments", () => {
    it("returns a paginated payments list", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/payments")
        .set(h());

      expect(res.status).toBe(200);
      const body = resBody<ApiResponse>(res).data as Record<string, unknown>;
      expect(Array.isArray(body.items)).toBe(true);
      const pagination = body.pagination as Record<string, unknown>;
      expect(typeof pagination.total).toBe("number");
    });

    it("accepts companyId and invoiceId filter params", async () => {
      const res = await request(testApp)
        .get(
          `/api/platform/billing/payments?companyId=${tenant.company.id}&page=1&limit=5`,
        )
        .set(h());

      expect(res.status).toBe(200);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp).get("/api/platform/billing/payments");

      expect(res.status).toBe(401);
    });
  });
});
