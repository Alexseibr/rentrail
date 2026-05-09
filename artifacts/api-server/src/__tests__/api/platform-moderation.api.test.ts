import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import {
  createTestUser,
  createTestTenant,
  assignRole,
} from "../../test/helpers";
import { db, companies, platformAuditLogs } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { resBody } from "../helpers/response-body";

type _RB = {
  data: Record<string, unknown>;
  error: { code: string; message: string };
};

type CompanyStatus = typeof companies.$inferSelect.status;

interface TenantContext {
  company: { id: string; name: string; slug: string };
  branch: { id: string };
  station: { id: string };
}

let platformAdmin: { token: string; id: string };
let platformSupport: { token: string; id: string };
let platformFinance: { token: string; id: string };
let regularUser: { token: string; id: string };
let tenantA: TenantContext;

async function forceCompanyStatus(companyId: string, status: CompanyStatus) {
  await db.update(companies).set({ status }).where(eq(companies.id, companyId));
}

beforeAll(async () => {
  const pa = await createTestUser({ platformRoleCodes: ["platformAdmin"] });
  platformAdmin = { token: pa.token, id: pa.id };

  const ps = await createTestUser({ platformRoleCodes: ["platformSupport"] });
  platformSupport = { token: ps.token, id: ps.id };

  const pf = await createTestUser({ platformRoleCodes: ["platformFinance"] });
  platformFinance = { token: pf.token, id: pf.id };

  const ru = await createTestUser({});
  regularUser = { token: ru.token, id: ru.id };

  tenantA = await createTestTenant({ companyName: "Moderation Test Co" });

  const owner = await createTestUser({});
  await assignRole(owner.id, tenantA.company.id, "owner", tenantA.branch.id);
});

describe("Platform Moderation", () => {
  describe("platform company list", () => {
    it("lists companies with pagination", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.items).toBeDefined();
      expect(resBody<_RB>(res).data.pagination).toBeDefined();
      expect(
        (resBody<_RB>(res).data.pagination as Record<string, unknown>).page,
      ).toBe(1);
      expect(
        (
          resBody<_RB>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("lists companies with counts", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      const company = (
        resBody<_RB>(res).data.items as unknown as Array<
          Record<string, unknown>
        >
      ).find((c: Record<string, unknown>) => c.id === tenantA.company.id);
      expect(company).toBeDefined();
      expect(company!.counts).toBeDefined();
      expect(typeof (company!.counts as Record<string, unknown>).branches).toBe(
        "number",
      );
      expect(typeof (company!.counts as Record<string, unknown>).assets).toBe(
        "number",
      );
    });

    it("filters by status", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies?status=pending")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      for (const item of resBody<_RB>(res).data.items as unknown as Array<
        Record<string, unknown>
      >) {
        expect(item.status).toBe("pending");
      }
    });

    it("searches by name", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies?search=Moderation`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(
        (
          resBody<_RB>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).some((c: { id: string }) => c.id === tenantA.company.id),
      ).toBe(true);
    });

    it("supports pagination params", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies?page=1&limit=2")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(
        (resBody<_RB>(res).data.pagination as Record<string, unknown>).limit,
      ).toBe(2);
      expect(
        (
          resBody<_RB>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeLessThanOrEqual(2);
    });

    it("filters by hasModeration flag", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies?hasModeration=true")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.items).toBeDefined();
    });

    it("regular user cannot list platform companies", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("platform company detail", () => {
    it("returns full detail with counts, owners, and moderation history", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies/${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.name).toBe("Moderation Test Co");
      expect(resBody<_RB>(res).data.counts).toBeDefined();
      expect(
        typeof (resBody<_RB>(res).data.counts as Record<string, unknown>)
          .clients,
      ).toBe("number");
      expect(
        typeof (resBody<_RB>(res).data.counts as Record<string, unknown>)
          .blacklistEntries,
      ).toBe("number");
      expect(resBody<_RB>(res).data.owners).toBeDefined();
      expect(Array.isArray(resBody<_RB>(res).data.owners)).toBe(true);
      expect(resBody<_RB>(res).data.moderationHistory).toBeDefined();
      expect(Array.isArray(resBody<_RB>(res).data.recentActivity)).toBe(true);
      expect(Array.isArray(resBody<_RB>(res).data.modules)).toBe(true);
      expect(resBody<_RB>(res).data).toHaveProperty("subscription");
    });

    it("returns correct owner contact shape", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies/${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      for (const owner of resBody<_RB>(res).data.owners as unknown as Array<
        Record<string, unknown>
      >) {
        expect(owner).toHaveProperty("userId");
        expect(owner).toHaveProperty("email");
        expect(owner).toHaveProperty("name");
      }
    });

    it("returns correct recent activity shape", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies/${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      for (const event of resBody<_RB>(res).data
        .recentActivity as unknown as Array<Record<string, unknown>>) {
        expect(event).toHaveProperty("action");
        expect(event).toHaveProperty("entityType");
        expect(event).toHaveProperty("createdAt");
      }
    });

    it("returns 404 for nonexistent company", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("moderation flow: approve", () => {
    let targetCompanyId: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({
        companyName: "Pending Approve Co",
      });
      targetCompanyId = tenant.company.id;
    });

    it("approves a pending company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/approve`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "verified", reasonText: "Documents verified" });

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.status).toBe("active");
      expect(resBody<_RB>(res).data.moderationReasonCode).toBe("verified");
    });

    it("cannot approve an already active company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/approve`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "verified", reasonText: "Retry approval" });

      expect(res.status).toBe(422);
    });
  });

  describe("moderation flow: block / unblock", () => {
    let targetCompanyId: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({ companyName: "Block Test Co" });
      targetCompanyId = tenant.company.id;
      await forceCompanyStatus(targetCompanyId, "active");
    });

    it("blocks an active company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/block`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          reasonCode: "fraud",
          reasonText: "Suspicious activity detected",
        });

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.status).toBe("blocked");
    });

    it("creates platform audit log for moderation action", async () => {
      const logs = await db
        .select()
        .from(platformAuditLogs)
        .where(
          and(
            eq(platformAuditLogs.targetCompanyId, targetCompanyId),
            eq(platformAuditLogs.action, "company.block"),
          ),
        )
        .orderBy(desc(platformAuditLogs.createdAt))
        .limit(1);

      expect(logs.length).toBe(1);
      expect(logs[0].entityType).toBe("company");
      expect(logs[0].actorUserId).toBe(platformAdmin.id);
    });

    it("unblocks a blocked company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/unblock`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "resolved", reasonText: "Investigation complete" });

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.status).toBe("active");
    });

    it("moderation history is recorded", async () => {
      const detail = await request(testApp)
        .get(`/api/platform/companies/${targetCompanyId}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(
        (
          resBody<_RB>(detail).data.moderationHistory as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe("moderation flow: suspend", () => {
    let targetCompanyId: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({ companyName: "Suspend Test Co" });
      targetCompanyId = tenant.company.id;
      await forceCompanyStatus(targetCompanyId, "active");
    });

    it("suspends an active company", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/suspend`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          reasonCode: "payment_overdue",
          reasonText: "Payment 30 days overdue",
        });

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.status).toBe("suspended");
    });

    it("cannot suspend a pending company", async () => {
      const tenant = await createTestTenant({
        companyName: "Pending Suspend Test",
      });
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/suspend`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "test", reasonText: "Suspension test" });

      expect(res.status).toBe(422);
    });
  });

  describe("moderation flow: cancel", () => {
    let targetCompanyId: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({ companyName: "Cancel Test Co" });
      targetCompanyId = tenant.company.id;
      await forceCompanyStatus(targetCompanyId, "active");
    });

    it("only superAdmin can cancel", async () => {
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/cancel`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ reasonCode: "requested", reasonText: "Cancellation attempt" });

      expect(res.status).toBe(403);
    });

    it("superAdmin cancels a company", async () => {
      const sa = await createTestUser({ platformRoleCodes: ["superAdmin"] });
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/cancel`)
        .set("Authorization", `Bearer ${sa.token}`)
        .send({
          reasonCode: "requested",
          reasonText: "Customer requested cancellation",
        });

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.status).toBe("canceled");
    });

    it("canceled company cannot be modified further", async () => {
      const sa = await createTestUser({ platformRoleCodes: ["superAdmin"] });
      const res = await request(testApp)
        .post(`/api/platform/companies/${targetCompanyId}/approve`)
        .set("Authorization", `Bearer ${sa.token}`)
        .send({
          reasonCode: "test",
          reasonText: "Attempt to reactivate canceled",
        });

      expect(res.status).toBe(422);
    });
  });

  describe("action-specific source-state guards", () => {
    it("unblock rejects from pending status (transition allowed, but action is wrong)", async () => {
      const tenant = await createTestTenant({
        companyName: "Guard Unblock Pending Co",
      });
      await forceCompanyStatus(tenant.company.id, "pending");
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/unblock`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          reasonCode: "test",
          reasonText: "Should fail: unblock only from blocked",
        });

      expect(res.status).toBe(409);
    });

    it("unblock rejects from suspended status (transition allowed, but action is wrong)", async () => {
      const tenant = await createTestTenant({
        companyName: "Guard Unblock Suspended Co",
      });
      await forceCompanyStatus(tenant.company.id, "suspended");
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/unblock`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({
          reasonCode: "test",
          reasonText: "Should fail: unblock only from blocked",
        });

      expect(res.status).toBe(409);
    });

    it("approve rejects from suspended status (transition allowed, but action is wrong)", async () => {
      const tenant = await createTestTenant({
        companyName: "Guard Approve Suspended Co",
      });
      await forceCompanyStatus(tenant.company.id, "suspended");
      const sa = await createTestUser({ platformRoleCodes: ["superAdmin"] });
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/approve`)
        .set("Authorization", `Bearer ${sa.token}`)
        .send({
          reasonCode: "test",
          reasonText: "Should fail: approve only from pending/trial",
        });

      expect(res.status).toBe(409);
    });

    it("approve rejects from blocked status (blocked→active allowed, but approve is wrong action)", async () => {
      const tenant = await createTestTenant({
        companyName: "Guard Approve Blocked Co",
      });
      await forceCompanyStatus(tenant.company.id, "blocked");
      const sa = await createTestUser({ platformRoleCodes: ["superAdmin"] });
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/approve`)
        .set("Authorization", `Bearer ${sa.token}`)
        .send({
          reasonCode: "test",
          reasonText: "Should fail: approve only from pending/trial",
        });

      expect(res.status).toBe(409);
    });
  });

  describe("tenant enforcement: blocked company", () => {
    let blockedCompanyId: string;
    let blockedTenantOwnerToken: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({
        companyName: "Blocked Tenant Co",
      });
      blockedCompanyId = tenant.company.id;
      const owner = await createTestUser({});
      await assignRole(owner.id, blockedCompanyId, "owner", tenant.branch.id);
      blockedTenantOwnerToken = owner.token;

      await forceCompanyStatus(blockedCompanyId, "blocked");
    });

    it("blocked tenant user gets 403 on all tenant-scoped reads", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${blockedTenantOwnerToken}`)
        .set("x-company-id", blockedCompanyId);

      expect(res.status).toBe(403);
      expect(resBody<_RB>(res).error.code).toBe("COMPANY_BLOCKED");
    });

    it("blocked tenant user gets 403 on writes", async () => {
      const res = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${blockedTenantOwnerToken}`)
        .set("x-company-id", blockedCompanyId)
        .send({ fullName: "Test" });

      expect(res.status).toBe(403);
      expect(resBody<_RB>(res).error.code).toBe("COMPANY_BLOCKED");
    });
  });

  describe("tenant enforcement: canceled company", () => {
    let canceledCompanyId: string;
    let canceledOwnerToken: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({
        companyName: "Canceled Tenant Co",
      });
      canceledCompanyId = tenant.company.id;
      const owner = await createTestUser({});
      await assignRole(owner.id, canceledCompanyId, "owner", tenant.branch.id);
      canceledOwnerToken = owner.token;

      await forceCompanyStatus(canceledCompanyId, "canceled");
    });

    it("canceled tenant user gets 403", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${canceledOwnerToken}`)
        .set("x-company-id", canceledCompanyId);

      expect(res.status).toBe(403);
      expect(resBody<_RB>(res).error.code).toBe("COMPANY_BLOCKED");
    });
  });

  describe("tenant enforcement: suspended company", () => {
    let suspendedCompanyId: string;
    let suspendedOwnerToken: string;

    beforeAll(async () => {
      const tenant = await createTestTenant({
        companyName: "Suspended Tenant Co",
      });
      suspendedCompanyId = tenant.company.id;
      const owner = await createTestUser({});
      await assignRole(owner.id, suspendedCompanyId, "owner", tenant.branch.id);
      suspendedOwnerToken = owner.token;

      await forceCompanyStatus(suspendedCompanyId, "suspended");
    });

    it("suspended tenant user can read", async () => {
      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${suspendedOwnerToken}`)
        .set("x-company-id", suspendedCompanyId);

      expect(res.status).toBe(200);
    });

    it("suspended tenant user cannot create assets", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set("Authorization", `Bearer ${suspendedOwnerToken}`)
        .set("x-company-id", suspendedCompanyId)
        .send({
          branchId: "00000000-0000-0000-0000-000000000000",
          assetType: "bike",
          serialNumber: "SUSP-001",
        });

      expect(res.status).toBe(403);
      expect(resBody<_RB>(res).error.code).toBe("COMPANY_SUSPENDED");
    });

    it("suspended tenant user cannot create clients", async () => {
      const res = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${suspendedOwnerToken}`)
        .set("x-company-id", suspendedCompanyId)
        .send({ fullName: "Test Client" });

      expect(res.status).toBe(403);
      expect(resBody<_RB>(res).error.code).toBe("COMPANY_SUSPENDED");
    });

    it("suspended tenant user cannot create branches", async () => {
      const res = await request(testApp)
        .post("/api/branches")
        .set("Authorization", `Bearer ${suspendedOwnerToken}`)
        .set("x-company-id", suspendedCompanyId)
        .send({ name: "Test Branch" });

      expect(res.status).toBe(403);
      expect(resBody<_RB>(res).error.code).toBe("COMPANY_SUSPENDED");
    });
  });

  describe("platform role restrictions", () => {
    it("platformFinance cannot perform moderation actions", async () => {
      const tenant = await createTestTenant();
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/approve`)
        .set("Authorization", `Bearer ${platformFinance.token}`)
        .send({ reasonCode: "test", reasonText: "Finance role test" });

      expect(res.status).toBe(403);
    });

    it("platformSupport can view but not moderate", async () => {
      const listRes = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformSupport.token}`);
      expect(listRes.status).toBe(200);

      const tenant = await createTestTenant();
      const modRes = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/approve`)
        .set("Authorization", `Bearer ${platformSupport.token}`)
        .send({ reasonCode: "test", reasonText: "Support role test" });
      expect(modRes.status).toBe(403);
    });

    it("requires reasonCode for moderation action", async () => {
      const tenant = await createTestTenant();
      const res = await request(testApp)
        .post(`/api/platform/companies/${tenant.company.id}/approve`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({});

      expect(res.status).toBe(422);
    });
  });

  describe("company usage endpoint", () => {
    it("returns resource counts", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies/${tenantA.company.id}/usage`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.companyId).toBe(tenantA.company.id);
      expect(resBody<_RB>(res).data.plan).toBeDefined();
      expect(resBody<_RB>(res).data.resources).toBeDefined();
      expect(
        (resBody<_RB>(res).data.resources as Record<string, unknown>).branches,
      ).toHaveProperty("current");
      expect(
        (resBody<_RB>(res).data.resources as Record<string, unknown>).branches,
      ).toHaveProperty("limit");
      expect(
        typeof (
          (resBody<_RB>(res).data.resources as Record<string, unknown>)
            .branches as Record<string, unknown>
        ).current,
      ).toBe("number");
      expect(
        typeof (
          (resBody<_RB>(res).data.resources as Record<string, unknown>)
            .branches as Record<string, unknown>
        ).limit,
      ).toBe("number");
    });
  });

  describe("company health endpoint", () => {
    it("returns health summary with incidents", async () => {
      const res = await request(testApp)
        .get(`/api/platform/companies/${tenantA.company.id}/health`)
        .set("Authorization", `Bearer ${platformAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.companyId).toBe(tenantA.company.id);
      expect(resBody<_RB>(res).data.assets).toBeDefined();
      expect(
        (resBody<_RB>(res).data.assets as Record<string, unknown>).issues,
      ).toBeDefined();
      expect(
        typeof (
          (resBody<_RB>(res).data.assets as Record<string, unknown>)
            .issues as Record<string, unknown>
        ).blocked,
      ).toBe("number");
      expect(resBody<_RB>(res).data.rentals).toBeDefined();
      expect(resBody<_RB>(res).data.incidents).toBeDefined();
      expect(
        typeof (resBody<_RB>(res).data.incidents as Record<string, unknown>)
          .activeBlacklistEntries,
      ).toBe("number");
      expect(
        typeof (resBody<_RB>(res).data.incidents as Record<string, unknown>)
          .lostOrStolenAssets,
      ).toBe("number");
      expect(
        typeof (resBody<_RB>(res).data.incidents as Record<string, unknown>)
          .overdueRentals,
      ).toBe("number");
      expect(
        typeof (resBody<_RB>(res).data.incidents as Record<string, unknown>)
          .disputedRentals,
      ).toBe("number");
    });
  });

  describe("support inspection endpoints", () => {
    it("returns tenant summary", async () => {
      const res = await request(testApp)
        .get(`/api/platform/support/tenants/${tenantA.company.id}/summary`)
        .set("Authorization", `Bearer ${platformSupport.token}`);

      expect(res.status).toBe(200);
      expect(
        (resBody<_RB>(res).data.company as Record<string, unknown>).id,
      ).toBe(tenantA.company.id);
      expect(resBody<_RB>(res).data.counts).toBeDefined();
      expect(resBody<_RB>(res).data.recentActivity).toBeDefined();
    });

    it("returns tenant audit log", async () => {
      const res = await request(testApp)
        .get(`/api/platform/support/tenants/${tenantA.company.id}/audit`)
        .set("Authorization", `Bearer ${platformSupport.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.items).toBeDefined();
      expect(resBody<_RB>(res).data.pagination).toBeDefined();
    });

    it("returns tenant health", async () => {
      const res = await request(testApp)
        .get(`/api/platform/support/tenants/${tenantA.company.id}/health`)
        .set("Authorization", `Bearer ${platformSupport.token}`);

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.companyId).toBe(tenantA.company.id);
    });

    it("regular user cannot access support endpoints", async () => {
      const res = await request(testApp)
        .get(`/api/platform/support/tenants/${tenantA.company.id}/summary`)
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });

    it("platformFinance cannot access support endpoints", async () => {
      const res = await request(testApp)
        .get(`/api/platform/support/tenants/${tenantA.company.id}/summary`)
        .set("Authorization", `Bearer ${platformFinance.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("platform company update", () => {
    it("platform admin can update company details", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/companies/${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformAdmin.token}`)
        .send({ legalName: "Moderation Test Co Ltd." });

      expect(res.status).toBe(200);
      expect(resBody<_RB>(res).data.legalName).toBe("Moderation Test Co Ltd.");
    });

    it("platformSupport cannot update company", async () => {
      const res = await request(testApp)
        .patch(`/api/platform/companies/${tenantA.company.id}`)
        .set("Authorization", `Bearer ${platformSupport.token}`)
        .send({ legalName: "Hacked" });

      expect(res.status).toBe(403);
    });
  });
});
