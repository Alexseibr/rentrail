import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import { createTestUser, createTestTenant } from "../../test/helpers";
import { db, platformAuditLogs } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { resBody, type ApiResponse } from "../helpers";

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
      expect(resBody<ApiResponse>(res).data.name).toBe("Test Plan");
      expect(resBody<ApiResponse>(res).data.price).toBe(9900);
      expect(resBody<ApiResponse>(res).data.maxBranches).toBe(5);
      expect(resBody<ApiResponse>(res).data.enabledModules).toContain(
        "organization",
      );
      createdPlanId = resBody<ApiResponse>(res).data.id as string;
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
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
      expect(
        (
          resBody<ApiResponse>(res).data as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
      for (const plan of resBody<ApiResponse>(res).data as unknown as Array<
        Record<string, unknown>
      >) {
        expect(plan.isActive).toBe(true);
      }
    });

    it("updates a plan", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/billing/plans/${createdPlanId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ name: "Updated Plan", price: 12900 });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.name).toBe("Updated Plan");
      expect(resBody<ApiResponse>(res).data.price).toBe(12900);
    });

    it("deactivates a plan", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/billing/plans/${createdPlanId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.isActive).toBe(false);
    });

    it("includes inactive plans when requested", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/plans?includeInactive=true")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      const deactivated = (
        resBody<ApiResponse>(res).data as unknown as Array<
          Record<string, unknown>
        >
      ).find((p: Record<string, unknown>) => p.id === createdPlanId);
      expect(deactivated).toBeDefined();
      expect(deactivated!.isActive).toBe(false);
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
      activePlanId = resBody<ApiResponse>(planRes).data.id as string;
    });

    it("assigns a plan to a company via set-plan", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenantA.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: activePlanId });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.companyId).toBe(tenantA.company.id);
      expect(resBody<ApiResponse>(res).data.planId).toBe(activePlanId);
      expect(resBody<ApiResponse>(res).data.status).toBe("trial");
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
        .send({
          name: "Sub Lifecycle",
          code: `sub-lc-${Date.now()}`,
          price: 7900,
        });
      subPlanId = resBody<ApiResponse>(planRes).data.id as string;

      const tenant = await createTestTenant({
        companyName: "Sub Lifecycle Co",
      });
      const setRes = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: subPlanId });
      subscriptionId = resBody<ApiResponse>(setRes).data.id as string;
    });

    it("lists subscriptions", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.items).toBeDefined();
      expect(resBody<ApiResponse>(res).data.pagination).toBeDefined();
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("filters subscriptions by status", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions?status=trial")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
        expect(item.status).toBe("trial");
      }
    });

    it("gets subscription detail with plan info", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/subscriptions/${subscriptionId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(subscriptionId);
      expect(resBody<ApiResponse>(res).data.plan).toBeDefined();
      expect(
        (resBody<ApiResponse>(res).data.plan as Record<string, unknown>).name,
      ).toBe("Sub Lifecycle");
      expect(resBody<ApiResponse>(res).data.companyName).toBeDefined();
    });

    it("updates subscription periods", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(testApp)
        .patch(`/api/platform/billing/subscriptions/${subscriptionId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ currentPeriodStart: start, currentPeriodEnd: end });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.currentPeriodStart).toBeDefined();
      expect(resBody<ApiResponse>(res).data.currentPeriodEnd).toBeDefined();
    });

    it("activates a trial subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
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
      expect(resBody<ApiResponse>(res).data.status).toBe("past_due");
    });

    it("reactivates a past_due subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
    });

    it("cancels subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/cancel`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ reason: "Customer requested" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
      expect(resBody<ApiResponse>(res).data.canceledAt).toBeDefined();
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
          dueDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          notes: "Monthly subscription",
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.amount).toBe(9900);
      expect(resBody<ApiResponse>(res).data.status).toBe("draft");
      invoiceId = resBody<ApiResponse>(res).data.id as string;
    });

    it("lists invoices", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
      expect(resBody<ApiResponse>(res).data.pagination).toBeDefined();
    });

    it("filters invoices by companyId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?companyId=${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
        expect(item.companyId).toBe(tenantA.company.id);
      }
    });

    it("gets invoice detail", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices/${invoiceId}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(invoiceId);
      expect(resBody<ApiResponse>(res).data.companyName).toBe(
        "Billing Test Co",
      );
      expect(resBody<ApiResponse>(res).data.payments).toBeDefined();
    });

    it("issues a draft invoice", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/issue`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("issued");
      expect(resBody<ApiResponse>(res).data.issuedAt).toBeDefined();
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
      expect(resBody<ApiResponse>(res).data.status).toBe("paid");
      expect(resBody<ApiResponse>(res).data.paidAt).toBeDefined();
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
      expect(
        (
          resBody<ApiResponse>(res).data.payments as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        (
          resBody<ApiResponse>(res).data.payments as unknown as Array<
            Record<string, unknown>
          >
        )[0].method,
      ).toBe("card");
      expect(
        (
          resBody<ApiResponse>(res).data.payments as unknown as Array<
            Record<string, unknown>
          >
        )[0].reference,
      ).toBe("ch_test123");
    });
  });

  describe("invoice date-range filtering", () => {
    it("filters invoices by from date", async () => {
      const from = new Date(Date.now() - 1000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?from=${encodeURIComponent(from)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
        expect(
          new Date(item.createdAt as string).getTime(),
        ).toBeGreaterThanOrEqual(new Date(from).getTime());
      }
    });

    it("filters invoices by to date", async () => {
      const to = new Date(Date.now() + 60000).toISOString();
      const res = await request(testApp)
        .get(`/api/platform/billing/invoices?to=${encodeURIComponent(to)}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
        expect(
          new Date(item.createdAt as string).getTime(),
        ).toBeLessThanOrEqual(new Date(to).getTime());
      }
    });

    it("filters invoices by combined from and to date range", async () => {
      const from = new Date(Date.now() - 60000).toISOString();
      const to = new Date(Date.now() + 60000).toISOString();
      const res = await request(testApp)
        .get(
          `/api/platform/billing/invoices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
        const ts = new Date(item.createdAt as string).getTime();
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
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBe(0);
    });

    it("combines date range with status and company filters", async () => {
      const from = new Date(Date.now() - 60000).toISOString();
      const res = await request(testApp)
        .get(
          `/api/platform/billing/invoices?companyId=${tenantA.company.id}&from=${encodeURIComponent(from)}`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
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
        .post(
          `/api/platform/billing/invoices/${resBody<ApiResponse>(createRes).data.id}/void`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("void");
      expect(resBody<ApiResponse>(res).data.voidedAt).toBeDefined();
    });

    it("cannot void a paid invoice", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ companyId: tenantA.company.id, amount: 3000 });

      await request(testApp)
        .post(
          `/api/platform/billing/invoices/${resBody<ApiResponse>(createRes).data.id}/issue`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`);

      await request(testApp)
        .post(
          `/api/platform/billing/invoices/${resBody<ApiResponse>(createRes).data.id}/mark-paid`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 3000, method: "wire" });

      const res = await request(testApp)
        .post(
          `/api/platform/billing/invoices/${resBody<ApiResponse>(createRes).data.id}/void`,
        )
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
      expect(resBody<ApiResponse>(res).data.items).toBeDefined();
      expect(resBody<ApiResponse>(res).data.pagination).toBeDefined();
    });

    it("filters payments by companyId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/billing/payments?companyId=${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<ApiResponse>(res).data
        .items as unknown as Array<Record<string, unknown>>) {
        expect(item.companyId).toBe(tenantA.company.id);
      }
    });
  });

  describe("subscription audit logging", () => {
    it("creates audit log for subscription activation", async () => {
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Audit Sub Plan",
          code: `audit-sub-${Date.now()}`,
          price: 1000,
        });

      const tenant = await createTestTenant({ companyName: "Audit Sub Co" });
      const setRes = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: resBody<ApiResponse>(planRes).data.id });

      await request(testApp)
        .post(
          `/api/platform/billing/subscriptions/${resBody<ApiResponse>(setRes).data.id}/activate`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ reason: "Trial completed" });

      const logs = await db
        .select()
        .from(platformAuditLogs)
        .where(
          and(
            eq(platformAuditLogs.action, "billing.subscription.activate"),
            eq(
              platformAuditLogs.entityId,
              resBody<ApiResponse>(setRes).data.id as string,
            ),
          ),
        )
        .orderBy(desc(platformAuditLogs.createdAt))
        .limit(1);

      expect(logs.length).toBe(1);
      expect(logs[0].actorUserId).toBe(platformFinance.id);
      expect(logs[0].reasonText).toBe("Trial completed");
    });
  });

  describe("plan limits for company", () => {
    it("company usage endpoint reflects plan limits after set-plan", async () => {
      const tenant = await createTestTenant({ companyName: "Plan Limits Co" });
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Limits Test Plan",
          code: `limits-test-${Date.now()}`,
          price: 2900,
          maxBranches: 3,
          maxStations: 8,
          maxAssets: 75,
          maxUsers: 7,
        });

      await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: resBody<ApiResponse>(planRes).data.id });

      const usageRes = await request(testApp)
        .get(`/api/platform/companies/${tenant.company.id}/usage`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(usageRes.status).toBe(200);
      expect(resBody<ApiResponse>(usageRes).data.plan).toBeDefined();
      expect(typeof resBody<ApiResponse>(usageRes).data.plan).toBe("string");
      expect(resBody<ApiResponse>(usageRes).data.plan).not.toBe("none");
    });
  });

  describe("inactive plan guard", () => {
    it("cannot assign an inactive plan to a company", async () => {
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Soon Inactive",
          code: `inactive-${Date.now()}`,
          price: 100,
        });

      await request(testApp)
        .patch(
          `/api/platform/billing/plans/${resBody<ApiResponse>(planRes).data.id}`,
        )
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ isActive: false });

      const tenant = await createTestTenant({
        companyName: "Inactive Plan Co",
      });
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId: resBody<ApiResponse>(planRes).data.id });

      expect(res.status).toBe(422);
      expect(resBody<ApiResponse>(res).error.code).toBe("PLAN_INACTIVE");
    });
  });

  describe("payment amount validation", () => {
    it("rejects payment with mismatched amount", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ companyId: tenantA.company.id, amount: 5000 });

      await request(testApp)
        .post(
          `/api/platform/billing/invoices/${resBody<ApiResponse>(createRes).data.id}/issue`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`);

      const res = await request(testApp)
        .post(
          `/api/platform/billing/invoices/${resBody<ApiResponse>(createRes).data.id}/mark-paid`,
        )
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 3000, method: "card" });

      expect(res.status).toBe(422);
      expect(resBody<ApiResponse>(res).error.code).toBe(
        "PAYMENT_AMOUNT_MISMATCH",
      );
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
      const res = await request(testApp).get("/api/platform/billing/plans");

      expect(res.status).toBe(401);
    });
  });
});
