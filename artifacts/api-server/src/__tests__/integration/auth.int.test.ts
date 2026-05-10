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
  assignRole,
  authHeaders,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

describe("Auth — integration", () => {
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  // ─── Registration ────────────────────────────────────────────────────────────

  describe("POST /api/auth/register", () => {
    it("creates a user and returns the record", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: `alice-${Date.now()}@example.com`,
        password: "StrongPass1!",
        firstName: "Alice",
        lastName: "Smith",
      });

      expect(res.status).toBe(201);
      const body = resBody<ApiResponse>(res);
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("email");
      expect(body.data).not.toHaveProperty("passwordHash");
    });

    it("persists the user so a subsequent login succeeds", async () => {
      const email = `persist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      await request(testApp).post("/api/auth/register").send({
        email,
        password: "StrongPass1!",
        firstName: "Persist",
        lastName: "Test",
      });

      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email, password: "StrongPass1!" });

      expect(loginRes.status).toBe(200);
      expect(resBody<ApiResponse>(loginRes).data).toHaveProperty("accessToken");
    });

    it("rejects a duplicate email", async () => {
      const email = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      const payload = {
        email,
        password: "StrongPass1!",
        firstName: "D",
        lastName: "U",
      };
      await request(testApp).post("/api/auth/register").send(payload);

      const res = await request(testApp)
        .post("/api/auth/register")
        .send(payload);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects a weak password", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: `weak-${Date.now()}@example.com`,
        password: "abc",
        firstName: "W",
        lastName: "P",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects missing firstName", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: `nofirst-${Date.now()}@example.com`,
        password: "StrongPass1!",
        lastName: "Only",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects missing password", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: `nopass-${Date.now()}@example.com`,
        firstName: "No",
        lastName: "Pass",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  describe("POST /api/auth/login", () => {
    const loginEmail = `login-${Date.now()}@example.com`;

    beforeAll(async () => {
      await request(testApp).post("/api/auth/register").send({
        email: loginEmail,
        password: "StrongPass1!",
        firstName: "Login",
        lastName: "User",
      });
    }, HOOK_TIMEOUT);

    it("returns accessToken and refreshToken on valid credentials", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: loginEmail, password: "StrongPass1!" });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(typeof data.accessToken).toBe("string");
      expect(typeof data.refreshToken).toBe("string");
    });

    it("returns the user object alongside tokens", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: loginEmail, password: "StrongPass1!" });

      expect(resBody<ApiResponse>(res).data).toHaveProperty("user");
    });

    it("rejects wrong password with 401", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: loginEmail, password: "WrongPassword9!" });

      expect(res.status).toBe(401);
    });

    it("rejects unknown email with 401", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: "ghost@example.com", password: "StrongPass1!" });

      expect(res.status).toBe(401);
    });

    it("rejects empty body with 4xx", async () => {
      const res = await request(testApp).post("/api/auth/login").send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── GET /auth/me ────────────────────────────────────────────────────────────

  describe("GET /api/auth/me", () => {
    let meToken: string;
    const meEmail = `me-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

    beforeAll(async () => {
      await request(testApp).post("/api/auth/register").send({
        email: meEmail,
        password: "StrongPass1!",
        firstName: "Me",
        lastName: "User",
      });
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: meEmail, password: "StrongPass1!" });
      meToken = resBody<ApiResponse>(loginRes).data.accessToken as string;
    }, HOOK_TIMEOUT);

    it("returns the authenticated user's profile", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${meToken}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.email).toBe(meEmail);
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(testApp).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 for an invalid token", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", "Bearer not.a.real.token");

      expect(res.status).toBe(401);
    });

    it("returns 401 for a tampered token signature", async () => {
      const parts = meToken.split(".");
      const tampered = `${parts[0]}.${parts[1]}.badsignature`;

      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${tampered}`);

      expect(res.status).toBe(401);
    });
  });

  // ─── Token refresh ───────────────────────────────────────────────────────────

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;
    let accessToken: string;
    const refreshEmail = `refresh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

    beforeAll(async () => {
      await request(testApp).post("/api/auth/register").send({
        email: refreshEmail,
        password: "StrongPass1!",
        firstName: "Refresh",
        lastName: "User",
      });
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: refreshEmail, password: "StrongPass1!" });
      const data = resBody<ApiResponse>(loginRes).data;
      refreshToken = data.refreshToken as string;
      accessToken = data.accessToken as string;
    }, HOOK_TIMEOUT);

    it("issues new tokens with a valid refresh token", async () => {
      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(typeof data.accessToken).toBe("string");
      expect(typeof data.refreshToken).toBe("string");
    });

    it("rejects an invalid refresh token", async () => {
      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: "totally-invalid" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects missing body", async () => {
      const res = await request(testApp).post("/api/auth/refresh").send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rotates refresh token — old token cannot be reused", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: refreshEmail, password: "StrongPass1!" });
      const rt = resBody<ApiResponse>(loginRes).data.refreshToken as string;

      await request(testApp).post("/api/auth/refresh").send({ refreshToken: rt });

      const reuse = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: rt });

      expect(reuse.status).toBeGreaterThanOrEqual(400);
    });

    it("refresh token is invalidated after logout", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: refreshEmail, password: "StrongPass1!" });
      const { accessToken: at, refreshToken: rt } =
        resBody<ApiResponse>(loginRes).data;

      await request(testApp)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${at as string}`);

      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: rt });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("access token still works (stateless JWT) immediately after logout", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("succeeds with a valid access token", async () => {
      const email = `logout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      await request(testApp).post("/api/auth/register").send({
        email,
        password: "StrongPass1!",
        firstName: "Logout",
        lastName: "User",
      });
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email, password: "StrongPass1!" });
      const token = resBody<ApiResponse>(loginRes).data.accessToken as string;

      const res = await request(testApp)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(testApp).post("/api/auth/logout");
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /auth/permissions ───────────────────────────────────────────────────

  describe("GET /api/auth/permissions", () => {
    let permUser: TestUser;
    let permTenant: TestTenant;

    beforeAll(async () => {
      permTenant = await createTestTenant({ companyName: "Perms Co" });
      permUser = await createTestUser({
        email: `perms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
      });
      await assignRole(
        permUser.id,
        permTenant.company.id,
        "admin",
        permTenant.branch.id,
      );
    }, HOOK_TIMEOUT);

    it("returns 401 without a token", async () => {
      const res = await request(testApp).get("/api/auth/permissions");
      expect(res.status).toBe(401);
    });

    it("returns a valid response for an authenticated user with company context", async () => {
      const res = await request(testApp)
        .get("/api/auth/permissions")
        .set(
          authHeaders(
            permUser.token,
            permTenant.company.id,
            permTenant.branch.id,
          ),
        );

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(data).toHaveProperty("permissions");
      expect(Array.isArray(data.permissions)).toBe(true);
    });
  });
});
