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
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(typeof res.body.data.pagination.total).toBe("number");
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
    expect(res.body.data.scopeType).toBe("global");
    expect(res.body.data.actionType).toBe("blocked_global");
    expect(res.body.data.fullNameSnapshot).toBe("John Doe");
    entryId = res.body.data.id;
  });

  it("lists entries with search filter", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?search=John")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it("lists entries with active filter", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?active=true")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it("gets a single entry by ID", async () => {
    const res = await request(testApp)
      .get(`/api/platform/blacklist/${entryId}`)
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(entryId);
  });

  it("updates a blacklist entry", async () => {
    const res = await request(testApp)
      .patch(`/api/platform/blacklist/${entryId}`)
      .set("Authorization", `Bearer ${platformRisk.token}`)
      .send({ reasonText: "Updated reason" });
    expect(res.status).toBe(200);
    expect(res.body.data.reasonText).toBe("Updated reason");
  });

  it("disables a blacklist entry", async () => {
    const res = await request(testApp)
      .post(`/api/platform/blacklist/${entryId}/disable`)
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.endsAt).not.toBeNull();
  });

  it("re-enables a blacklist entry", async () => {
    const res = await request(testApp)
      .post(`/api/platform/blacklist/${entryId}/enable`)
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.endsAt).toBeNull();
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
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by email field", async () => {
    const res = await request(testApp)
      .get("/api/platform/blacklist?email=john@fraud")
      .set("Authorization", `Bearer ${platformRisk.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
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
    expect(res.body.data).toBeNull();
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
    expect(res.body.data.brandNameOverride).toBe("Task4 Brand");
    expect(res.body.data.primaryColor).toBe("#FF5500");
    expect(res.body.data.status).toBe("disabled");
  });

  it("updates existing settings via PATCH", async () => {
    const res = await request(testApp)
      .patch(`/api/platform/companies/${companyId}/white-label`)
      .set("Authorization", `Bearer ${platformAdmin.token}`)
      .send({ secondaryColor: "#00AAFF" });
    expect(res.status).toBe(200);
    expect(res.body.data.secondaryColor).toBe("#00AAFF");
    expect(res.body.data.primaryColor).toBe("#FF5500");
  });

  it("rejects enable when plan is not eligible", async () => {
    const res = await request(testApp)
      .post(`/api/platform/companies/${companyId}/white-label/enable`)
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PLAN_NOT_ELIGIBLE");
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
    expect(res.body.data.status).toBe("enabled");
    expect(res.body.data.enabledAt).not.toBeNull();
  });

  it("disables white-label", async () => {
    const res = await request(testApp)
      .post(`/api/platform/companies/${companyId}/white-label/disable`)
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("disabled");
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
    expect(res.body.data.tenants).toBeDefined();
    expect(res.body.data.tenants.total).toBeGreaterThanOrEqual(0);
    expect(res.body.data.assets).toBeDefined();
    expect(res.body.data.devices).toBeDefined();
    expect(res.body.data.build).toBeDefined();
    expect(typeof res.body.data.build.uptime).toBe("number");
    expect(res.body.data.services).toBeInstanceOf(Array);
    expect(res.body.data.services.length).toBe(5);
  });

  it("returns all service statuses", async () => {
    const res = await request(testApp)
      .get("/api/platform/health/services")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = res.body.data.map((s: any) => s.name);
    expect(names).toContain("Email Service");
    expect(names).toContain("Object Storage");
  });

  it("returns specific service diagnostic", async () => {
    const res = await request(testApp)
      .get("/api/platform/diagnostics/storage")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Object Storage");
    expect(res.body.data.status).toBe("ok");
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
    expect(res.body.data).toBeInstanceOf(Array);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty("healthStatus");
      expect(res.body.data[0]).toHaveProperty("assets");
      expect(res.body.data[0]).toHaveProperty("devices");
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
    expect(res.body.data.tenants).toBeDefined();
    expect(typeof res.body.data.mrrEstimate).toBe("number");
    expect(res.body.data.planDistribution).toBeInstanceOf(Array);
  });

  it("returns top tenants by rentals", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/tenants?metric=rentals&limit=5")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.metric).toBe("rentals");
    expect(res.body.data.items).toBeInstanceOf(Array);
  });

  it("returns top tenants by assets", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/tenants?metric=assets")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.metric).toBe("assets");
  });

  it("returns billing metrics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/billing")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toBeDefined();
    expect(res.body.data.revenue).toBeDefined();
  });

  it("returns usage metrics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/usage")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.totalCompanies).toBe("number");
    expect(res.body.data.averages).toBeDefined();
  });

  it("returns risk metrics", async () => {
    const res = await request(testApp)
      .get("/api/platform/analytics/risks")
      .set("Authorization", `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.blacklist).toBeDefined();
    expect(res.body.data.incidents).toBeDefined();
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
