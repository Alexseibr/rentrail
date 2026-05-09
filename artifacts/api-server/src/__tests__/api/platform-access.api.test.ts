import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { createTestUser } from "../../test/helpers";
import { seedRolesAndPermissions } from "../../test/seed-rbac-inline";
import { db, platformAuditLogs } from "@workspace/db";
import { resBody, type ApiResponse } from "../helpers/response-body";

const testApp = app;

describe("Platform Access Model", () => {
  let superAdminUser: { id: string; email: string | undefined; token: string };
  let platformAdminUser: {
    id: string;
    email: string | undefined;
    token: string;
  };
  let platformSupportUser: {
    id: string;
    email: string | undefined;
    token: string;
  };
  let platformFinanceUser: {
    id: string;
    email: string | undefined;
    token: string;
  };
  let regularUser: { id: string; email: string | undefined; token: string };

  beforeAll(async () => {
    await seedRolesAndPermissions();

    superAdminUser = await createTestUser({
      platformRoleCodes: ["superAdmin"],
    });
    platformAdminUser = await createTestUser({
      platformRoleCodes: ["platformAdmin"],
    });
    platformSupportUser = await createTestUser({
      platformRoleCodes: ["platformSupport"],
    });
    platformFinanceUser = await createTestUser({
      platformRoleCodes: ["platformFinance"],
    });
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
        .set(
          "Authorization",
          `Bearer ${resBody<ApiResponse>(loginRes).data.accessToken}`,
        );

      expect(meRes.status).toBe(200);
      expect(resBody<ApiResponse>(meRes).data.platformRoles).toContain(
        "superAdmin",
      );
    });

    it("login returns empty platformRoles for regular user", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: regularUser.email, password: "TestPass123!" });

      expect(loginRes.status).toBe(200);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${resBody<ApiResponse>(loginRes).data.accessToken}`,
        );

      expect(meRes.status).toBe(200);
      expect(resBody<ApiResponse>(meRes).data.platformRoles).toEqual([]);
    });

    it("platform user gets platformRoles in /me response", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: platformAdminUser.email, password: "TestPass123!" });

      expect(loginRes.status).toBe(200);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${resBody<ApiResponse>(loginRes).data.accessToken}`,
        );

      expect(meRes.status).toBe(200);
      expect(resBody<ApiResponse>(meRes).data.platformRoles).toContain(
        "platformAdmin",
      );
    });
  });

  describe("requirePlatformRole middleware", () => {
    it("allows superAdmin to access platform audit logs", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("items");
      expect(resBody<ApiResponse>(res).data).toHaveProperty("pagination");
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
      const res = await request(testApp).get("/api/platform/audit-logs");

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
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(3);
      expect(
        (resBody<ApiResponse>(res).data.pagination as Record<string, unknown>)
          .page,
      ).toBe(1);
      expect(
        (resBody<ApiResponse>(res).data.pagination as Record<string, unknown>)
          .limit,
      ).toBe(10);
    });

    it("filters by action", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?action=company.block")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).every(
          (action: Record<string, unknown>) =>
            action.action === "company.block",
        ),
      ).toBe(true);
    });

    it("filters by entityType", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?entityType=subscription")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).every(
          (entityType: Record<string, unknown>) =>
            entityType.entityType === "subscription",
        ),
      ).toBe(true);
    });

    it("filters by actorUserId", async () => {
      const res = await request(testApp)
        .get(`/api/platform/audit-logs?actorUserId=${platformAdminUser.id}`)
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      expect(
        (
          resBody<ApiResponse>(res).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).every(
          (actorUserId: Record<string, unknown>) =>
            actorUserId.actorUserId === platformAdminUser.id,
        ),
      ).toBe(true);
    });

    it("includes actor details in response", async () => {
      const res = await request(testApp)
        .get("/api/platform/audit-logs?limit=1")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(res.status).toBe(200);
      const item = (
        resBody<ApiResponse>(res).data.items as unknown as Array<
          Record<string, unknown>
        >
      )[0];
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
      expect(resBody<ApiResponse>(res).data.name).toBe(`Test Co ${ts}`);
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

    it("platform user can list all companies via platform endpoint", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformSupportUser.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.items).toBeDefined();
      expect(Array.isArray(resBody<ApiResponse>(res).data.items)).toBe(true);
      expect(resBody<ApiResponse>(res).data.pagination).toBeDefined();
    });

    it("regular user cannot access platform company listing", async () => {
      const res = await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });

    it("GET /companies returns only user memberships (no platform bypass)", async () => {
      const res = await request(testApp)
        .get("/api/companies")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
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
      expect(
        (
          resBody<ApiResponse>(logsRes).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        (
          resBody<ApiResponse>(logsRes).data.items as unknown as Array<
            Record<string, unknown>
          >
        )[0].action,
      ).toBe("company.create");
    });

    it("platform company listing is audited", async () => {
      await request(testApp)
        .get("/api/platform/companies")
        .set("Authorization", `Bearer ${platformAdminUser.token}`);

      const logsRes = await request(testApp)
        .get("/api/platform/audit-logs?action=company.list_all")
        .set("Authorization", `Bearer ${superAdminUser.token}`);

      expect(logsRes.status).toBe(200);
      expect(
        (
          resBody<ApiResponse>(logsRes).data.items as unknown as Array<
            Record<string, unknown>
          >
        ).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        (
          resBody<ApiResponse>(logsRes).data.items as unknown as Array<
            Record<string, unknown>
          >
        )[0].action,
      ).toBe("company.list_all");
    });
  });

  describe("non-superAdmin platform roles do NOT grant tenant bypass", () => {
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

  describe("superAdmin platform role derives isSuperAdmin for tenant bypass", () => {
    it("superAdmin platform role user gets isSuperAdmin=true in JWT", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: superAdminUser.email, password: "TestPass123!" });

      expect(loginRes.status).toBe(200);

      const token = resBody<ApiResponse>(loginRes).data.accessToken as string;
      const [, payloadB64] = token.split(".");
      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString(),
      ) as { isSuperAdmin: boolean; platformRoles: string[] };
      expect(payload.isSuperAdmin).toBe(true);
      expect(payload.platformRoles).toContain("superAdmin");
    });

    it("superAdmin platform role can access tenant assets via isSuperAdmin bypass", async () => {
      const { createTestTenant } = await import("../../test/helpers");
      const tenant = await createTestTenant();

      const res = await request(testApp)
        .get("/api/assets")
        .set("Authorization", `Bearer ${superAdminUser.token}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(200);
    });
  });

  describe("backward compatibility", () => {
    it("legacy isSuperAdmin=true user still bypasses tenant permissions", async () => {
      const legacyAdmin = await createTestUser({ isSuperAdmin: true });

      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${legacyAdmin.token}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.isSuperAdmin).toBe(true);
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
