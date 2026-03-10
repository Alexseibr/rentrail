import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db, companies, platformAuditLogs } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  testApp,
  acquireTestLock,
  cleanDatabase,
  clearRolesCache,
  seedRolesAndPermissions,
  createTestUser,
  createTestTenant,
  createTestClient,
  assignRole,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

type CompanyStatus = typeof companies.$inferSelect.status;

async function forceCompanyStatus(companyId: string, status: CompanyStatus) {
  await db.update(companies).set({ status }).where(eq(companies.id, companyId));
}

describe("Platform Admin — integration", () => {
  let platformAdmin: TestUser;
  let platformFinance: TestUser;
  let platformSupport: TestUser;
  let superAdmin: TestUser;
  let regularUser: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();

    platformAdmin = await createTestUser({
      email: `plat-admin-${Date.now()}@test.com`,
      platformRoleCodes: ["platformAdmin"],
    });
    platformFinance = await createTestUser({
      email: `plat-finance-${Date.now()}@test.com`,
      platformRoleCodes: ["platformFinance"],
    });
    platformSupport = await createTestUser({
      email: `plat-support-${Date.now()}@test.com`,
      platformRoleCodes: ["platformSupport"],
    });
    superAdmin = await createTestUser({
      email: `super-admin-${Date.now()}@test.com`,
      platformRoleCodes: ["superAdmin"],
    });
    regularUser = await createTestUser({
      email: `regular-${Date.now()}@test.com`,
    });

    tenant = await createTestTenant({ companyName: "Platform Admin Int Co" });
    const owner = await createTestUser({
      email: `owner-${Date.now()}@test.com`,
    });
    await assignRole(owner.id, tenant.company.id, "owner", tenant.branch.id);
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  // ─── Company list ────────────────────────────────────────────────────────────

  describe("GET /api/platform/companies", () => {
    it("platform admin can list companies", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.items).toBeDefined();
      expect(resBody<ApiResponse>(res).data.pagination).toBeDefined();
    });

    it("platform support can list companies", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformSupport.token}`);

      expect(res.status).toBe(200);
    });

    it("regular user cannot list platform companies", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp).get("/api/platform/companies");
      expect(res.status).toBe(401);
    });

    it("includes the seeded test tenant in the list", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      const items = resBody<ApiResponse>(res).data.items as unknown as Array<{
        id: string;
      }>;
      expect(items.some((c) => c.id === tenant.company.id)).toBe(true);
    });

    it("filters by name search", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies?search=Platform+Admin+Int")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      const items = resBody<ApiResponse>(res).data.items as unknown as Array<{
        id: string;
      }>;
      expect(items.some((c) => c.id === tenant.company.id)).toBe(true);
    });

    it("pagination limits results correctly", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies?page=1&limit=1")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      const items = resBody<ApiResponse>(res).data
        .items as unknown as Array<unknown>;
      expect(items.length).toBeLessThanOrEqual(1);
      expect(
        (resBody<ApiResponse>(res).data.pagination as Record<string, unknown>)
          .limit,
      ).toBe(1);
    });
  });

  // ─── Company detail ──────────────────────────────────────────────────────────

  describe("GET /api/platform/companies/:id", () => {
    it("returns full company detail with counts and owners", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies/${tenant.company.id}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(tenant.company.id);
      expect(resBody<ApiResponse>(res).data.counts).toBeDefined();
      expect(resBody<ApiResponse>(res).data.owners).toBeDefined();
      expect(Array.isArray(resBody<ApiResponse>(res).data.owners)).toBe(true);
      expect(resBody<ApiResponse>(res).data.moderationHistory).toBeDefined();
    });

    it("returns 404 for unknown company id", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── Moderation: approve ─────────────────────────────────────────────────────

  describe("moderation — approve", () => {
    let targetId: string;

    beforeAll(async () => {
      const t = await createTestTenant({ companyName: "Approve Int Co" });
      targetId = t.company.id;
    }, HOOK_TIMEOUT);

    it("platform admin approves a pending company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetId}/approve`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "verified", reasonText: "Documents verified" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
    });

    it("cannot approve an already active company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetId}/approve`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "verified", reasonText: "Retry" });

      expect(res.status).toBe(422);
    });

    it("platform finance cannot approve", async () => {
      const t = await createTestTenant({ companyName: "Finance Approve Co" });
      const res = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/approve`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ reasonCode: "test", reasonText: "Finance attempt" });

      expect(res.status).toBe(403);
    });

    it("requires reasonCode field", async () => {
      const t = await createTestTenant({ companyName: "No Reason Code Co" });
      const res = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/approve`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonText: "No reason code" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Moderation: block / unblock ─────────────────────────────────────────────

  describe("moderation — block/unblock", () => {
    let targetId: string;

    beforeAll(async () => {
      const t = await createTestTenant({ companyName: "Block Int Co" });
      targetId = t.company.id;
      await forceCompanyStatus(targetId, "active");
    }, HOOK_TIMEOUT);

    it("platform admin blocks an active company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetId}/block`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "fraud", reasonText: "Fraudulent activity" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("blocked");
    });

    it("block action creates platform audit log", async () => {
      const logs = await db
        .select()
        .from(platformAuditLogs)
        .where(
          and(
            eq(platformAuditLogs.targetCompanyId, targetId),
            eq(platformAuditLogs.action, "company.block"),
          ),
        )
        .orderBy(desc(platformAuditLogs.createdAt))
        .limit(1);

      expect(logs.length).toBe(1);
      expect(logs[0].actorUserId).toBe(platformAdmin.id);
    });

    it("unblocks a blocked company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetId}/unblock`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "resolved", reasonText: "Issue resolved" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
    });

    it("moderation history records both actions", async () => {
      const detail = await request(testApp)
        .get(`/api/platform/companies/${targetId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      const history = resBody<ApiResponse>(detail).data
        .moderationHistory as unknown as Array<unknown>;
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Moderation: suspend ─────────────────────────────────────────────────────

  describe("moderation — suspend", () => {
    let targetId: string;

    beforeAll(async () => {
      const t = await createTestTenant({ companyName: "Suspend Int Co" });
      targetId = t.company.id;
      await forceCompanyStatus(targetId, "active");
    }, HOOK_TIMEOUT);

    it("suspends an active company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetId}/suspend`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          reasonCode: "payment_overdue",
          reasonText: "30 days overdue",
        });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("suspended");
    });

    it("cannot suspend a pending company", async () => {
      const t = await createTestTenant({ companyName: "Pending Suspend Int" });
      const res = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/suspend`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "test", reasonText: "Test" });

      expect(res.status).toBe(422);
    });

    it("suspended tenant can still read but not write", async () => {
      const susTenant = await createTestTenant({
        companyName: "Suspended Tenant Int",
      });
      const susOwner = await createTestUser({
        email: `sus-owner-${Date.now()}@test.com`,
      });
      await assignRole(
        susOwner.id,
        susTenant.company.id,
        "owner",
        susTenant.branch.id,
      );
      await forceCompanyStatus(susTenant.company.id, "suspended");

      const readRes = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${susOwner.token}`)
        .set("x-company-id", susTenant.company.id);
      expect(readRes.status).toBe(200);

      const writeRes = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${susOwner.token}`)
        .set("x-company-id", susTenant.company.id)
        .send({ fullName: "New Client" });
      expect(writeRes.status).toBe(403);
      expect(resBody<ApiResponse>(writeRes).error.code).toBe(
        "COMPANY_SUSPENDED",
      );
    });
  });

  // ─── Moderation: cancel ──────────────────────────────────────────────────────

  describe("moderation — cancel", () => {
    it("only superAdmin can cancel a company", async () => {
      const t = await createTestTenant({ companyName: "Cancel Int Co" });
      await forceCompanyStatus(t.company.id, "active");

      const nonSaRes = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/cancel`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "requested", reasonText: "Attempt" });
      expect(nonSaRes.status).toBe(403);

      const saRes = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/cancel`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          reasonCode: "requested",
          reasonText: "Customer requested",
        });
      expect(saRes.status).toBe(200);
      expect(resBody<ApiResponse>(saRes).data.status).toBe("canceled");
    });

    it("canceled company cannot be further moderated", async () => {
      const t = await createTestTenant({ companyName: "Already Canceled Int" });
      await forceCompanyStatus(t.company.id, "active");
      await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/cancel`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({ reasonCode: "requested", reasonText: "Cancel it" });

      const approveRes = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/approve`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({ reasonCode: "test", reasonText: "Reactivate" });
      expect(approveRes.status).toBe(422);
    });

    it("canceled tenant gets 403 on all requests", async () => {
      const cancelTenant = await createTestTenant({
        companyName: "Canceled Tenant Int",
      });
      const cancelOwner = await createTestUser({
        email: `cancel-owner-${Date.now()}@test.com`,
      });
      await assignRole(
        cancelOwner.id,
        cancelTenant.company.id,
        "owner",
        cancelTenant.branch.id,
      );
      await forceCompanyStatus(cancelTenant.company.id, "canceled");

      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${cancelOwner.token}`)
        .set("x-company-id", cancelTenant.company.id);
      expect(res.status).toBe(403);
      expect(resBody<ApiResponse>(res).error.code).toBe("COMPANY_BLOCKED");
    });
  });

  // ─── Platform blacklist (global) ─────────────────────────────────────────────

  describe("platform blacklist", () => {
    it("platform admin can list global blacklist entries", async () => {
      const res = await request(testApp)
        .get("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.items).toBeDefined();
      expect(resBody<ApiResponse>(res).data.pagination).toBeDefined();
    });

    it("regular user cannot access global blacklist", async () => {
      const res = await request(testApp)
        .get("/api/platform/blacklist")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });

    it("platform admin can create a global blacklist entry", async () => {
      const suffix = Date.now();
      const res = await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          actionType: "blocked_global",
          reasonCode: "fraud",
          reasonText: "Fraudulent activity detected globally",
          phoneSnapshot: `+7999${suffix}`,
          fullNameSnapshot: `Bad Actor ${suffix}`,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.actionType).toBe("blocked_global");
      expect(resBody<ApiResponse>(res).data.reasonCode).toBe("fraud");
    });

    it("global blacklist entry appears in the list after creation", async () => {
      const suffix = `${Date.now()}-list`;
      await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          actionType: "warning",
          reasonCode: "suspicious",
          phoneSnapshot: `+7888${suffix.replace(/\D/g, "").slice(0, 7)}`,
        });

      const res = await request(testApp)
        .get("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      const items = resBody<ApiResponse>(res).data
        .items as unknown as Array<unknown>;
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it("requires actionType and reasonCode to create entry", async () => {
      const res = await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonText: "Missing required fields" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("platform finance cannot create global blacklist entries", async () => {
      const res = await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({
          actionType: "blocked_global",
          reasonCode: "fraud",
        });

      expect(res.status).toBe(403);
    });

    it("platform admin can retrieve a single blacklist entry", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          actionType: "increased_deposit",
          reasonCode: "late_payment",
          fullNameSnapshot: `Detail Test ${Date.now()}`,
        });
      expect(createRes.status).toBe(201);
      const entryId = resBody<ApiResponse>(createRes).data.id as string;

      const getRes = await request(testApp)
        .get(`/api/platform/blacklist/${entryId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(getRes.status).toBe(200);
      expect(resBody<ApiResponse>(getRes).data.id).toBe(entryId);
      expect(resBody<ApiResponse>(getRes).data.actionType).toBe(
        "increased_deposit",
      );
    });

    it("platform admin can update a blacklist entry", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          actionType: "warning",
          reasonCode: "minor_issue",
          fullNameSnapshot: `Update Test ${Date.now()}`,
        });
      expect(createRes.status).toBe(201);
      const entryId = resBody<ApiResponse>(createRes).data.id as string;

      const patchRes = await request(testApp)
        .patch(`/api/platform/blacklist/${entryId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "major_issue", reasonText: "Updated reason" });

      expect(patchRes.status).toBe(200);
      expect(resBody<ApiResponse>(patchRes).data.reasonCode).toBe(
        "major_issue",
      );
    });

    it("platform admin can disable (expire) a blacklist entry", async () => {
      const createRes = await request(testApp)
        .post("/api/platform/blacklist")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          actionType: "restricted_access",
          reasonCode: "test_disable",
        });
      expect(createRes.status).toBe(201);
      const entryId = resBody<ApiResponse>(createRes).data.id as string;

      const disableRes = await request(testApp)
        .post(`/api/platform/blacklist/${entryId}/disable`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(disableRes.status).toBe(200);
      expect(resBody<ApiResponse>(disableRes).data.endsAt).toBeTruthy();
    });
  });

  // ─── Tenant blacklist (company-scoped) ───────────────────────────────────────

  describe("tenant blacklist", () => {
    it("admin can add a client to the company blacklist", async () => {
      const sfx = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const localClient = await createTestClient(tenant.company.id, {
        phone: `+7${sfx.slice(0, 10).padEnd(10, "0")}`,
        email: `bl-client-${sfx}@test.com`,
      });
      const ownerUser = await createTestUser({
        email: `bl-owner-${sfx}@test.com`,
      });
      await assignRole(
        ownerUser.id,
        tenant.company.id,
        "owner",
        tenant.branch.id,
      );

      const res = await request(testApp)
        .post("/api/blacklist")
        .set("Authorization", `Bearer ${ownerUser.token}`)
        .set("x-company-id", tenant.company.id)
        .send({
          clientId: localClient.id,
          scopeType: "company",
          actionType: "blocked_company",
          reasonCode: "non_payment",
          reasonText: "Client refused to pay",
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.clientId).toBe(localClient.id);
      expect(resBody<ApiResponse>(res).data.scopeType).toBe("company");
    });

    it("admin can list blacklist entries for their company", async () => {
      const ownerUser = await createTestUser({
        email: `bl-list-owner-${Date.now()}@test.com`,
      });
      await assignRole(
        ownerUser.id,
        tenant.company.id,
        "owner",
        tenant.branch.id,
      );

      const res = await request(testApp)
        .get("/api/blacklist")
        .set("Authorization", `Bearer ${ownerUser.token}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("blacklist check returns status for a client", async () => {
      const rnd2 = Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000);
      const sfx2 = `${rnd2}${Math.floor(Math.random() * 1e6)}`;
      const ownerUser = await createTestUser({
        email: `bl-check-owner-${sfx2}@test.com`,
      });
      await assignRole(
        ownerUser.id,
        tenant.company.id,
        "owner",
        tenant.branch.id,
      );
      const localClient = await createTestClient(tenant.company.id, {
        phone: `+7${rnd2}`,
        email: `bl-check-client-${sfx2}@test.com`,
      });

      const res = await request(testApp)
        .post("/api/blacklist/check")
        .set("Authorization", `Bearer ${ownerUser.token}`)
        .set("x-company-id", tenant.company.id)
        .send({ clientId: localClient.id });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("isBlacklisted");
      expect(resBody<ApiResponse>(res).data).toHaveProperty("entries");
    });
  });

  // ─── Platform billing: plans ─────────────────────────────────────────────────

  describe("platform billing — plan lifecycle", () => {
    let planId: string;

    it("platform admin can create a billing plan", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Integration Test Plan",
          code: `int-plan-${Date.now()}`,
          price: 7900,
          billingInterval: "monthly",
          maxBranches: 3,
          maxAssets: 50,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.name).toBe("Integration Test Plan");
      planId = resBody<ApiResponse>(res).data.id as string;
    });

    it("can assign plan to a company", async () => {
      const t = await createTestTenant({ companyName: "Set Plan Int Co" });
      const res = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.companyId).toBe(t.company.id);
      expect(resBody<ApiResponse>(res).data.status).toBe("trial");
    });

    it("platform support cannot create plans", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformSupport.token}`)
        .send({
          name: "Support Plan",
          code: `sup-plan-${Date.now()}`,
          price: 0,
        });

      expect(res.status).toBe(403);
    });

    it("platform admin can update a plan", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/billing/plans/${planId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ name: "Updated Int Plan", price: 9900 });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.name).toBe("Updated Int Plan");
      expect(resBody<ApiResponse>(res).data.price).toBe(9900);
    });
  });

  // ─── Platform billing: subscriptions ─────────────────────────────────────────

  describe("platform billing — subscription lifecycle", () => {
    let subscriptionId: string;

    beforeAll(async () => {
      const planRes = await request(testApp)
        .post("/api/platform/billing/plans")
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          name: "Sub Test Plan",
          code: `sub-test-${Date.now()}`,
          price: 4900,
        });
      const planId = resBody<ApiResponse>(planRes).data.id as string;

      const t = await createTestTenant({ companyName: "Sub Lifecycle Int Co" });
      const setRes = await request(testApp)
        .post(`/api/platform/companies/${t.company.id}/set-plan`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ planId });
      subscriptionId = resBody<ApiResponse>(setRes).data.id as string;
    }, HOOK_TIMEOUT);

    it("platform finance can list subscriptions", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/subscriptions")
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.items).toBeDefined();
    });

    it("activates a trial subscription", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/subscriptions/${subscriptionId}/activate`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
    });

    it("cannot activate an already active subscription", async () => {
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

    it("can reactivate a past_due subscription", async () => {
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
    });
  });

  // ─── Platform billing: invoices ──────────────────────────────────────────────

  describe("platform billing — invoice lifecycle", () => {
    let invoiceId: string;

    it("platform finance can create an invoice", async () => {
      const res = await request(testApp)
        .post("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({
          companyId: tenant.company.id,
          amount: 9900,
          currency: "RUB",
          dueDate: new Date(Date.now() + 30 * 86400_000).toISOString(),
          notes: "Integration test invoice",
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.status).toBe("draft");
      expect(resBody<ApiResponse>(res).data.amount).toBe(9900);
      invoiceId = resBody<ApiResponse>(res).data.id as string;
    });

    it("issues the draft invoice", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/issue`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("issued");
    });

    it("marks invoice as paid", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/mark-paid`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 9900, method: "card", reference: "int-test-ref" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("paid");
    });

    it("cannot pay a paid invoice again", async () => {
      const res = await request(testApp)
        .post(`/api/platform/billing/invoices/${invoiceId}/mark-paid`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ amount: 9900, method: "card" });

      expect(res.status).toBe(422);
    });

    it("regular user cannot access invoices", async () => {
      const res = await request(testApp)
        .get("/api/platform/billing/invoices")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });
  });
});
