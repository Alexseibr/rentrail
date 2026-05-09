import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import {
  createTestUser,
  createTestTenant,
  createTestClient,
} from "../../test/helpers";
import {
  db,
  saasPlans,
  saasSubscriptions,
  blacklistEntries,
} from "@workspace/db";
import { checkClientBlacklist } from "../../services/blacklist.service";

type _RB = {
  data: Record<string, unknown>;
  error: { code: string; message: string };
};
function rb(r: { body: unknown }): _RB {
  return r.body as _RB;
}

let platformAdmin: { token: string; id: string };
let platformRisk: { token: string; id: string };
let platformFinance: { token: string; id: string };
let regularUser: { token: string; id: string };
let companyId: string;

beforeAll(async () => {
  const pa = await createTestUser({ platformRoleCodes: ["platformAdmin"] });
  platformAdmin = { token: pa.token, id: pa.id };

  const pr = await createTestUser({ platformRoleCodes: ["platformRisk"] });
  platformRisk = { token: pr.token, id: pr.id };

  const pf = await createTestUser({ platformRoleCodes: ["platformFinance"] });
  platformFinance = { token: pf.token, id: pf.id };

  const ru = await createTestUser({});
  regularUser = { token: ru.token, id: ru.id };

  const tenantA = await createTestTenant({ companyName: "Task4 Test Co" });
  companyId = tenantA.company.id;
});

describe("Platform Global Blacklist", () => {
  let entryId: string;

  it("rejects unauthenticated access", async () => {
    const res = await request(testApp).get("/api/platform/blacklist");
    expect(res.status).toBe(401);
  });

  it("rejects regular users", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist")
      .set("Authorization", `Bearer ${regularUser.token}`);
    expect(res.status).toBe(403);
  });

  it("allows platformRisk to list", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.items).toBeInstanceOf(Array);
    expect(
      typeof (rb(res).data.pagination as Record<string, unknown>).total,
    ).toBe("number");
  });

  it("creates a global blacklist entry", async () => {
    const res = await request(testApp)
      .post("/api/platform/blacklist")
      .set("Authorization", `Bearer ${platformRisk.token}`)
      .send({
        actionType: "blocked_global",
        reasonCode: "fraud",
        reasonText: "Test fraud entry",
        fullNameSnapshot: "John Doe",
        emailSnapshot: "john@fraud.test",
        phoneSnapshot: "+1234567890",
        documentSnapshot: "ID-999",
      });

    expect(res.status).toBe(201);
    expect(rb(res).data.scopeType).toBe("global");
    expect(rb(res).data.actionType).toBe("blocked_global");
    expect(rb(res).data.fullNameSnapshot).toBe("John Doe");
    entryId = rb(res).data.id as string;
  });

  it("lists entries with search filter", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?search=John")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(
      (rb(res).data.items as unknown as Array<Record<string, unknown>>).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("lists entries with active filter", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?active=true")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(
      (rb(res).data.items as unknown as Array<Record<string, unknown>>).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("gets a single entry by ID", async () => {
    const res = await request(testApp)
      .get(`/api/platform/blacklist/${entryId}`)
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.id).toBe(entryId);
  });

  it("updates a blacklist entry", async () => {
    const res = await request(testApp)
      .patch(`/api/platform/blacklist/${entryId}`)
      .set("Authorization", `Bearer ${platformRisk.token}`)
      .send({ reasonText: "Updated reason" });
    expect(res.status).toBe(200);
    expect(rb(res).data.reasonText).toBe("Updated reason");
  });

  it("disables a blacklist entry", async () => {
    const res = await request(testApp)
      .post(`/api/platform/blacklist/${entryId}/disable`)
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.endsAt).not.toBeNull();
  });

  it("re-enables a blacklist entry", async () => {
    const res = await request(testApp)
      .post(`/api/platform/blacklist/${entryId}/enable`)
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.endsAt).toBeNull();
  });

  it("returns 404 for non-existent entry", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(404);
  });

  it("platformAdmin can also access blacklist", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
  });

  it("platformFinance cannot access blacklist", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist")
      .set("Authorization", `Bearer ${platformFinance.token}`);
    expect(res.status).toBe(403);
  });

  it("filters by phone field", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?phone=1234567890")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(
      (rb(res).data.items as unknown as Array<Record<string, unknown>>).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("filters by email field", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?email=john@fraud")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(
      (rb(res).data.items as unknown as Array<Record<string, unknown>>).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("Platform White-Label", () => {
  it("rejects regular users", async () => {
    const res = await request(testApp)
      .get(`/api/platform/companies/${companyId}/white-label`)
      .set("Authorization", `Bearer ${regularUser.token}`);
    expect(res.status).toBe(403);
  });

  it("returns null when no settings exist", async () => {
    const res = await request(testApp)
      .get(`/api/platform/companies/${companyId}/white-label`)
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data).toBeNull();
  });

  it("creates settings via PATCH (upsert)", async () => {
    const res = await request(testApp)
      .patch(`/api/platform/companies/${companyId}/white-label`)
      .set("Authorization", `Bearer ${platformAdmin.token}`)
      .send({
        brandNameOverride: "Task4 Brand",
        primaryColor: "#FF5500",
        customSupportEmail: "support@task4.test",
      });
    expect(res.status).toBe(200);
    expect(rb(res).data.brandNameOverride).toBe("Task4 Brand");
    expect(rb(res).data.primaryColor).toBe("#FF5500");
    expect(rb(res).data.status).toBe("disabled");
  });

  it("updates existing settings via PATCH", async () => {
    const res = await request(testApp)
      .patch(`/api/platform/companies/${companyId}/white-label`)
      .set("Authorization", `Bearer ${platformAdmin.token}`)
      .send({ secondaryColor: "#00AAFF" });
    expect(res.status).toBe(200);
    expect(rb(res).data.secondaryColor).toBe("#00AAFF");
    expect(rb(res).data.primaryColor).toBe("#FF5500");
  });

  it("rejects enable when plan is not eligible", async () => {
    const res = await request(testApp)
      .post(`/api/platform/companies/${companyId}/white-label/enable`)
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(422);
    expect(rb(res).error.code).toBe("PLAN_NOT_ELIGIBLE");
  });

  it("allows enable when plan has whiteLabelAvailable", async () => {
    const planCode = `wl-plan-${Date.now()}`;
    const [plan] = await db
      .insert(saasPlans)
      .values({
        name: "WL Plan",
        code: planCode,
        price: 49900,
        whiteLabelAvailable: true,
      })
      .returning();

    await db.insert(saasSubscriptions).values({
      companyId: companyId,
      planId: plan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const res = await request(testApp)
      .post(`/api/platform/companies/${companyId}/white-label/enable`)
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.status).toBe("enabled");
    expect(rb(res).data.enabledAt).not.toBeNull();
  });

  it("disables white-label", async () => {
    const res = await request(testApp)
      .post(`/api/platform/companies/${companyId}/white-label/disable`)
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.status).toBe("disabled");
  });

  it("returns 404 for non-existent company", async () => {
    const res = await request(testApp)
      .get(
        "/api/platform/companies/00000000-0000-0000-0000-000000000000/white-label",
      )
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for enable on non-existent company", async () => {
    const res = await request(testApp)
      .post(
        "/api/platform/companies/00000000-0000-0000-0000-000000000000/white-label/enable",
      )
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(404);
  });
});

describe("Platform Diagnostics", () => {
  it("rejects regular users", async () => {
    const res = await request(testApp)
      .get("/api/platform/health/summary")
      .set("Authorization", `Bearer ${regularUser.token}`);
    expect(res.status).toBe(403);
  });

  it("returns health summary", async () => {
    const res = await request(testApp)
      .get("/api/platform/health/summary")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.tenants).toBeDefined();
    expect(
      (rb(res).data.tenants as Record<string, unknown>).total,
    ).toBeGreaterThanOrEqual(0);
    expect(rb(res).data.assets).toBeDefined();
    expect(rb(res).data.devices).toBeDefined();
    expect(rb(res).data.build).toBeDefined();
    expect(typeof (rb(res).data.build as Record<string, unknown>).uptime).toBe(
      "number",
    );
    expect(rb(res).data.services).toBeInstanceOf(Array);
    expect(
      (rb(res).data.services as unknown as Array<Record<string, unknown>>)
        .length,
    ).toBe(5);
  });

  it("returns all service statuses", async () => {
    const res = await request(testApp)
      .get("/api/platform/health/services")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data).toBeInstanceOf(Array);
    expect(
      (rb(res).data as unknown as Array<Record<string, unknown>>).length,
    ).toBe(5);
    const names = (
      rb(res).data as unknown as Array<Record<string, unknown>>
    ).map((s: { name: string }) => s.name);
    expect(names).toContain("Email Service");
    expect(names).toContain("Object Storage");
  });

  it("returns specific service diagnostic", async () => {
    const res = await request(testApp)
      .get("/api/platform/diagnostics/storage")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.name).toBe("Object Storage");
    expect(rb(res).data.status).toBe("ok");
  });

  it("returns 422 for invalid service name", async () => {
    const res = await request(testApp)
      .get("/api/platform/diagnostics/invalid-service")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(422);
  });

  it("returns tenant health list", async () => {
    const res = await request(testApp)
      .get("/api/platform/health/tenants")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data).toBeInstanceOf(Array);
    if (
      (rb(res).data as unknown as Array<Record<string, unknown>>).length > 0
    ) {
      expect(rb(res).data[0]).toHaveProperty("healthStatus");
      expect(rb(res).data[0]).toHaveProperty("assets");
      expect(rb(res).data[0]).toHaveProperty("devices");
    }
  });

  it("platformFinance cannot access diagnostics", async () => {
    const res = await request(testApp)
      .get("/api/platform/health/summary")
      .set("Authorization", `Bearer ${platformFinance.token}`);
    expect(res.status).toBe(403);
  });
});

describe("Platform Analytics", () => {
  it("rejects regular users", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/overview")
      .set("Authorization", `Bearer ${regularUser.token}`);
    expect(res.status).toBe(403);
  });

  it("returns overview", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/overview")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.tenants).toBeDefined();
    expect(typeof rb(res).data.mrrEstimate).toBe("number");
    expect(rb(res).data.planDistribution).toBeInstanceOf(Array);
  });

  it("returns top tenants by rentals", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/tenants?metric=rentals&limit=5")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.metric).toBe("rentals");
    expect(rb(res).data.items).toBeInstanceOf(Array);
  });

  it("returns top tenants by assets", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/tenants?metric=assets")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.metric).toBe("assets");
  });

  it("returns billing metrics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/billing")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.invoices).toBeDefined();
    expect(rb(res).data.revenue).toBeDefined();
  });

  it("returns usage metrics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/usage")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(typeof rb(res).data.totalCompanies).toBe("number");
    expect(rb(res).data.averages).toBeDefined();
  });

  it("returns risk metrics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/risks")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(rb(res).data.blacklist).toBeDefined();
    expect(rb(res).data.incidents).toBeDefined();
  });

  it("platformFinance can access analytics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/overview")
      .set("Authorization", `Bearer ${platformFinance.token}`);
    expect(res.status).toBe(200);
  });

  it("platformRisk cannot access analytics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/overview")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(403);
  });
});

describe("Global blacklist cross-tenant enforcement", () => {
  it("global entry matched by phone/email/document blocks tenant client", async () => {
    const uniquePhone = `+1-cross-${Date.now()}`;
    const uniqueEmail = `cross-${Date.now()}@test.com`;
    const uniqueDoc = `DOC-CROSS-${Date.now()}`;

    const client = await createTestClient(companyId, {
      fullName: "Cross Tenant Victim",
      phone: uniquePhone,
      email: uniqueEmail,
    });

    await db.insert(blacklistEntries).values({
      scopeType: "global",
      companyId: null,
      branchId: null,
      clientId: null,
      actionType: "blocked_global",
      reasonCode: "cross-tenant-fraud",
      phoneSnapshot: uniquePhone,
      emailSnapshot: uniqueEmail,
      documentSnapshot: uniqueDoc,
      fullNameSnapshot: "Cross Tenant Victim",
      startsAt: new Date(),
      createdByUserId: platformRisk.id,
    });

    const decision = await checkClientBlacklist(client.id, companyId);
    expect(decision.isBlacklisted).toBe(true);
    expect(decision.isBlocked).toBe(true);
    expect(decision.strongestAction).toBe("blocked_global");
    expect(decision.entries.some((e) => e.scopeType === "global")).toBe(true);
  });
});
