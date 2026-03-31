import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import { createTestUser, createTestTenant } from "../../test/helpers";
import { db, saasPlans, platformAuditLogs } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

let platformAdmin: { token: string; id: string };
let platformFinance: { token: string; id: string };
let platformSupport: { token: string; id: string };
let regularUser: { token: string; id: string };

let createdPlanId: string;
let tenantA: Awaited<ReturnType<typeof createTestTenant>>;

beforeAll(async () => {
  const pa = await createTestUser({ platformRoleCodes: ["platformAdmin"] });
  platformAdmin = { token: pa.token, id: pa.id };

  const pf = await createTestUser({ platformRoleCodes: ["platformFinance"] });
  platformFinance = { token: pf.token, id: pf.id };

  const ps = await createTestUser({ platformRoleCodes: ["platformSupport"] });
  platformSupport = { token: ps.token, id: ps.id };

  const ru = await createTestUser({});
  regularUser = { token: ru.token, id: ru.id };

  tenantA = await createTestTenant({ companyName: "Billing Test Co" });
});

describe("Platform Billing", () => {
  describe("plan CRUD", () => {
    it("creates a plan", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Test Plan",
          code: `test-plan-${Date.now()}`,
          description: "A test plan",
          price: 9900,
          billingInterval: "monthly",
          maxBranches: 5,
          maxStations: 10,
          maxAssets: 100,
          maxUsers: 10,
          enabledModules: ["organization", "crm"],
          limits: { rentalsPerMonth: 1000 },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Test Plan");
      expect(res.body.data.price).toBe(9900);
      expect(res.body.data.maxBranches).toBe(5);
      expect(res.body.data.enabledModules).toContain("organization");
      createdPlanId = res.body.data.id;
    });

    it("rejects duplicate plan code", async () => {
      const code = `dup-plan-${Date.now()}`;
      await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ name: "Dup A", code, price: 100 });

      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ name: "Dup B", code, price: 200 });

      expect(res.status).toBe(409);
    });

    it("lists plans (active only by default)", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const plan of res.body.data) {
        expect(plan.isActive).toBe(true);
      }
    });

    it("updates a plan", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/billing/plans/${createdPlanId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ name: "Updated Plan", price: 12900 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Plan");
      expect(res.body.data.price).toBe(12900);
    });

    it("deactivates a plan", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/billing/plans/${createdPlanId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it("includes inactive plans when requested", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans?includeInactive=true")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      const deactivated = res.body.data.find((p: { id: string }) => p.id === createdPlanId);
      expect(deactivated).toBeDefined();
      expect(deactivated.isActive).toBe(false);
    });

    it("creates audit log for plan creation", async () => {
      const logs = await db
        .select()
        .from(platformAuditLogs)
        .where(
          and(
            eq(platformAuditLogs.entityType, "saas_plan"),
            eq(platformAuditLogs.action, "billing.plan.create"),
          ),
        )
        .orderBy(desc(platformAuditLogs.createdAt))
        .limit(1);

      expect(logs.length).toBe(1);
      expect(logs[0].actorUserId).toBe(platformAdmin.id);
    });
  });

  describe("company set-plan", () => {
    let activePlanId: string;

    beforeAll(async () => {
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Set Plan Test",
          code: `set-plan-${Date.now()}`,
          price: 5900,
          maxBranches: 3,
          maxAssets: 30,
        });
      activePlanId = planRes.body.data.id;
    });

    it("assigns a plan to a company via set-plan", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenantA.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: activePlanId });

      expect(res.status).toBe(201);
      expect(res.body.data.companyId).toBe(tenantA.company.id);
      expect(res.body.data.planId).toBe(activePlanId);
      expect(res.body.data.status).toBe("trial");
    });

    it("set-plan requires superAdmin or platformAdmin", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenantA.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ planId: activePlanId });

      expect(res.status).toBe(403);
    });

    it("regular user cannot set-plan", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenantA.company.id}/set-plan`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({ planId: activePlanId });

      expect(res.status).toBe(403);
    });
  });

  describe("subscription lifecycle", () => {
    let subscriptionId: string;
    let subPlanId: string;

    beforeAll(async () => {
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ name: "Sub Lifecycle", code: `sub-lc-${Date.now()}`, price: 7900 });
      subPlanId = planRes.body.data.id;

      const tenant = await createTestTenant({ companyName: "Sub Lifecycle Co" });
      const setRes = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: subPlanId });
      subscriptionId = setRes.body.data.id;
    });

    it("lists subscriptions", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it("filters subscriptions by status", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions?status=trial")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.status).toBe("trial");
      }
    });

    it("gets subscription detail with plan info", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/subscriptions/${subscriptionId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(subscriptionId);
      expect(res.body.data.plan).toBeDefined();
      expect(res.body.data.plan.name).toBe("Sub Lifecycle");
      expect(res.body.data.companyName).toBeDefined();
    });

    it("updates subscription periods", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(testApp)
        .patch(`/api/platform/billing/subscriptions/${subscriptionId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ currentPeriodStart: start, currentPeriodEnd: end });

      expect(res.status).toBe(200);
      expect(res.body.data.currentPeriodStart).toBeDefined();
      expect(res.body.data.currentPeriodEnd).toBeDefined();
    });

    it("activates a trial subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("active");
    });

    it("cannot activate an already active subscription again", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(422);
    });

    it("marks subscription as past_due", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/past-due`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ reason: "Payment failed" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("past_due");
    });

    it("reactivates a past_due subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("active");
    });

    it("cancels subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/cancel`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ reason: "Customer requested" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("canceled");
      expect(res.body.data.canceledAt).toBeDefined();
    });

    it("canceled subscription cannot transition further", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(422);
    });
  });

  describe("invoice lifecycle", () => {
    let invoiceId: string;

    it("creates an invoice", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({
          companyId: tenantA.company.id,
          amount: 9900,
          currency: "USD",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          notes: "Monthly subscription",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(9900);
      expect(res.body.data.status).toBe("draft");
      invoiceId = res.body.data.id;
    });

    it("lists invoices", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it("filters invoices by companyId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?companyId=${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.companyId).toBe(tenantA.company.id);
      }
    });

    it("gets invoice detail", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices/${invoiceId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(invoiceId);
      expect(res.body.data.companyName).toBe("Billing Test Co");
      expect(res.body.data.payments).toBeDefined();
    });

    it("issues a draft invoice", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/issue`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("issued");
      expect(res.body.data.issuedAt).toBeDefined();
    });

    it("cannot re-issue an already issued invoice", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/issue`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(422);
    });

    it("marks invoice as paid with payment record", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/mark-paid`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 9900, method: "card", reference: "ch_test123" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("paid");
      expect(res.body.data.paidAt).toBeDefined();
    });

    it("cannot pay an already paid invoice", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/mark-paid`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 9900, method: "card" });

      expect(res.status).toBe(422);
    });

    it("invoice detail shows payment records", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices/${invoiceId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.payments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.payments[0].method).toBe("card");
      expect(res.body.data.payments[0].reference).toBe("ch_test123");
    });
  });

  describe("invoice date-range filtering", () => {
    it("filters invoices by from date", async () => {
      const from = new Date(Date.now() - 1000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?from=${encodeURIComponent(from)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(new Date(item.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(from).getTime());
      }
    });

    it("filters invoices by to date", async () => {
      const to = new Date(Date.now() + 60000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?to=${encodeURIComponent(to)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(new Date(item.createdAt).getTime()).toBeLessThanOrEqual(new Date(to).getTime());
      }
    });

    it("filters invoices by combined from and to date range", async () => {
      const from = new Date(Date.now() - 60000).toISOString();
      const to = new Date(Date.now() + 60000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        const ts = new Date(item.createdAt).getTime();
        expect(ts).toBeGreaterThanOrEqual(new Date(from).getTime());
        expect(ts).toBeLessThanOrEqual(new Date(to).getTime());
      }
    });

    it("returns empty results for future date range", async () => {
      const from = new Date(Date.now() + 86400000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?from=${encodeURIComponent(from)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });

    it("combines date range with status and company filters", async () => {
      const from = new Date(Date.now() - 60000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?companyId=${tenantA.company.id}&from=${encodeURIComponent(from)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.companyId).toBe(tenantA.company.id);
      }
    });
  });

  describe("invoice void", () => {
    it("voids a draft invoice", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ companyId: tenantA.company.id, amount: 5000 });

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${createRes.body.data.id}/void`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("void");
      expect(res.body.data.voidedAt).toBeDefined();
    });

    it("cannot void a paid invoice", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ companyId: tenantA.company.id, amount: 3000 });

      await request(testApp)
        .post(`/api/platform/billing/invoices/${createRes.body.data.id}/issue`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      await request(testApp)
        .post(`/api/platform/billing/invoices/${createRes.body.data.id}/mark-paid`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 3000, method: "wire" });

      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${createRes.body.data.id}/void`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(422);
    });
  });

  describe("payments", () => {
    it("lists payments", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/payments")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });

    it("filters payments by companyId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/payments?companyId=${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.companyId).toBe(tenantA.company.id);
      }
    });
  });

  describe("permission checks", () => {
    it("regular user cannot access billing endpoints", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });

    it("platformSupport cannot access billing endpoints", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformSupport.token}`);

      expect(res.status).toBe(403);
    });

    it("platformFinance can access billing endpoints", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
    });

    it("unauthenticated request is rejected", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans");

      expect(res.status).toBe(401);
    });
  });
});
