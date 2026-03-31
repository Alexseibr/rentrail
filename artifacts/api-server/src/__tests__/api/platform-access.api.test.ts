import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { createTestUser, authHeaders } from "../../test/helpers";
import { seedRolesAndPermissions } from "../../test/seed-rbac-inline";
import { db, platformAuditLogs } from "@workspace/db";

interface AuditLogItem {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorFirstName: string;
  actorLastName: string;
  platformRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  targetCompanyId: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  createdAt: string;
}

const testApp = app;

describe("Platform Access Model", () => {
  let superAdminUser: { id: string; email: string; token: string };
  let platformAdminUser: { id: string; email: string; token: string };
  let platformSupportUser: { id: string; email: string; token: string };
  let platformFinanceUser: { id: string; email: string; token: string };
  let regularUser: { id: string; email: string; token: string };

  beforeAll(async () => {
    await seedRolesAndPermissions();

    superAdminUser = await createTestUser({ platformRoleCodes: ["superAdmin"] });
    platformAdminUser = await createTestUser({ platformRoleCodes: ["platformAdmin"] });
    platformSupportUser = await createTestUser({ platformRoleCodes: ["platformSupport"] });
    platformFinanceUser = await createTestUser({ platformRoleCodes: ["platformFinance"] });
    regularUser = await createTestUser({});
  });

  describe("JWT platform roles", () => {
    it("login returns platformRoles in token for platform user", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: superAdminUser.email, password: "TestPass123!" });

      expect(loginRes.status).toBe(200);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.platformRoles).toContain("superAdmin");
    });

    it("login returns empty platformRoles for regular user", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: regularUser.email, password: "TestPass123!" });

      expect(loginRes.status).toBe(200);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.platformRoles).toEqual([]);
    });

    it("platform user gets platformRoles in /me response", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: platformAdminUser.email, password: "TestPass123!" });

      expect(loginRes.status).toBe(200);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.platformRoles).toContain("platformAdmin");
    });
  });

  describe("requirePlatformRole middleware", () => {
    it("allows superAdmin to access platform audit logs", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("pagination");
    });

    it("allows platformAdmin to access platform audit logs", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs")
        .set("Authorization", `Bearer ${platformAdminUser.token}`);

      expect(res.status).toBe(200);
    });

    it("rejects platformSupport from audit logs (insufficient role)", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs")
        .set("Authorization", `Bearer ${platformSupportUser.token}`);

      expect(res.status).toBe(403);
    });

    it("rejects platformFinance from audit logs (insufficient role)", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs")
        .set("Authorization", `Bearer ${platformFinanceUser.token}`);

      expect(res.status).toBe(403);
    });

    it("rejects regular user (no platform roles)", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated request", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs");

      expect(res.status).toBe(401);
    });
  });

  describe("platform audit log query", () => {
    beforeAll(async () => {
      await db.insert(platformAuditLogs).values([
        {
          actorUserId: superAdminUser.id,
          platformRole: "superAdmin",
          action: "company.approve",
          entityType: "company",
          entityId: "00000000-0000-0000-0000-000000000001",
          reasonCode: "verified",
          reasonText: "Documents checked",
        },
        {
          actorUserId: superAdminUser.id,
          platformRole: "superAdmin",
          action: "company.block",
          entityType: "company",
          entityId: "00000000-0000-0000-0000-000000000002",
          reasonCode: "fraud",
          reasonText: "Suspicious activity",
        },
        {
          actorUserId: platformAdminUser.id,
          platformRole: "platformAdmin",
          action: "billing.plan_change",
          entityType: "subscription",
          entityId: "00000000-0000-0000-0000-000000000003",
        },
      ]);
    });

    it("returns paginated audit logs", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?page=1&limit=10")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it("filters by action", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?action=company.block")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((l: AuditLogItem) => l.action === "company.block")).toBe(true);
    });

    it("filters by entityType", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?entityType=subscription")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((l: AuditLogItem) => l.entityType === "subscription")).toBe(true);
    });

    it("filters by actorUserId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/audit-logs?actorUserId=${platformAdminUser.id}`)
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((l: AuditLogItem) => l.actorUserId === platformAdminUser.id)).toBe(true);
    });

    it("includes actor details in response", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?limit=1")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      const item = res.body.data.items[0];
      expect(item).toHaveProperty("actorEmail");
      expect(item).toHaveProperty("actorFirstName");
      expect(item).toHaveProperty("platformRole");
    });
  });

  describe("platform routes use requirePlatformRole (not isSuperAdmin)", () => {
    it("superAdmin can create a company", async () => {
      const ts = Date.now();
      const res = await request(testApp)
        .post("/api/companies")
        .set("Authorization", `Bearer ${superAdminUser.token}`)
        .send({ name: `Test Co ${ts}`, slug: `test-co-${ts}` });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(`Test Co ${ts}`);
    });

    it("platformAdmin can create a company", async () => {
      const ts = Date.now();
      const res = await request(testApp)
        .post("/api/companies")
        .set("Authorization", `Bearer ${platformAdminUser.token}`)
        .send({ name: `Admin Co ${ts}`, slug: `admin-co-${ts}` });

      expect(res.status).toBe(201);
    });

    it("platformSupport cannot create a company", async () => {
      const res = await request(testApp)
        .post("/api/companies")
        .set("Authorization", `Bearer ${platformSupportUser.token}`)
        .send({ name: "Blocked Co", slug: "blocked-co" });

      expect(res.status).toBe(403);
    });

    it("regular user cannot create a company", async () => {
      const res = await request(testApp)
        .post("/api/companies")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({ name: "No Access Co", slug: "no-access-co" });

      expect(res.status).toBe(403);
    });

    it("platform user can list all companies", async () => {
      const res = await request(testApp)
        .get("/api/companies")
        .set("Authorization", `Bearer ${platformSupportUser.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("isSuperAdmin without platform role cannot list all companies", async () => {
      const legacyAdmin = await createTestUser({ isSuperAdmin: true });
      const regularNonPlatform = await createTestUser({});

      const legacyRes = await request(testApp)
        .get("/api/companies")
        .set("Authorization", `Bearer ${legacyAdmin.token}`);

      const regularRes = await request(testApp)
        .get("/api/companies")
        .set("Authorization", `Bearer ${regularNonPlatform.token}`);

      expect(legacyRes.body.data).toEqual(regularRes.body.data);
    });

    it("company creation is logged to platform audit log", async () => {
      const ts = Date.now();
      await request(testApp)
        .post("/api/companies")
        .set("Authorization", `Bearer ${superAdminUser.token}`)
        .send({ name: `Audited Co ${ts}`, slug: `audited-co-${ts}` });

      const logsRes = await request(testApp)
        .get("/api/platform/audit-logs?action=company.create")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(logsRes.body.data.items[0].action).toBe("company.create");
    });
  });

  describe("platform role does NOT grant tenant superAdmin bypass", () => {
    it("platformAdmin cannot access tenant assets without company membership", async () => {
      const { createTestTenant } = await import("../../test/helpers");
      const tenant = await createTestTenant();

      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${platformAdminUser.token}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(403);
    });

    it("platformSupport cannot access tenant data without company membership", async () => {
      const { createTestTenant } = await import("../../test/helpers");
      const tenant = await createTestTenant();

      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${platformSupportUser.token}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(403);
    });

    it("platformFinance cannot access tenant data without company membership", async () => {
      const { createTestTenant } = await import("../../test/helpers");
      const tenant = await createTestTenant();

      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${platformFinanceUser.token}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(403);
    });
  });

  describe("backward compatibility", () => {
    it("legacy isSuperAdmin=true user still bypasses tenant permissions", async () => {
      const legacyAdmin = await createTestUser({ isSuperAdmin: true });

      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${legacyAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isSuperAdmin).toBe(true);
    });

    it("isSuperAdmin=true user CAN access tenant assets without membership", async () => {
      const { createTestTenant } = await import("../../test/helpers");
      const legacyAdmin = await createTestUser({ isSuperAdmin: true });
      const tenant = await createTestTenant();

      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${legacyAdmin.token}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(200);
    });
  });
});
