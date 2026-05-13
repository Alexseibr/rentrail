import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { testApp } from "../helpers";
import { createTestTenant } from "../helpers";
import { resBody, type ApiResponse } from "../helpers";

describe("Auth API", () => {
  beforeAll(async () => {});

  afterAll(async () => {});

  const testEmail = `auth-test-${Date.now()}@test.com`;
  const testPassword = "SecurePass123!";

  describe("POST /api/auth/register", () => {
    it("creates a new user", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: testEmail,
        password: testPassword,
        firstName: "Auth",
        lastName: "Test",
      });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("id");
      expect(resBody<ApiResponse>(res).data.email).toBe(testEmail);
    });

    it("rejects duplicate email", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: testEmail,
        password: testPassword,
        firstName: "Dup",
        lastName: "User",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects short password", async () => {
      const res = await request(testApp).post("/api/auth/register").send({
        email: "short@test.com",
        password: "123",
        firstName: "Short",
        lastName: "Pass",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects missing required fields", async () => {
      const res = await request(testApp)
        .post("/api/auth/register")
        .send({ email: "incomplete@test.com" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns tokens on valid credentials", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("accessToken");
      expect(resBody<ApiResponse>(res).data).toHaveProperty("refreshToken");
      expect(typeof resBody<ApiResponse>(res).data.accessToken).toBe("string");
      expect(typeof resBody<ApiResponse>(res).data.refreshToken).toBe("string");
    });

    it("rejects wrong password", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "WrongPass999!" });

      expect(res.status).toBe(401);
    });

    it("rejects non-existent email", async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: "nobody@nowhere.com", password: testPassword });

      expect(res.status).toBe(401);
    });

    it("rejects empty body", async () => {
      const res = await request(testApp).post("/api/auth/login").send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /api/auth/me", () => {
    let freshToken: string;

    beforeAll(async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });
      freshToken = resBody<ApiResponse>(res).data.accessToken as string;
    });

    it("returns current user with valid token", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${freshToken}`);

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.email).toBe(testEmail);
    });

    it("rejects missing token", async () => {
      const res = await request(testApp).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("rejects invalid token", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken123");

      expect(res.status).toBe(401);
    });

    it("rejects malformed authorization header", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", "NotBearer something");

      expect(res.status).toBe(401);
    });

    it("rejects expired/tampered token", async () => {
      const parts = freshToken.split(".");
      const tamperedToken = parts[0] + "." + parts[1] + ".invalidsignature";

      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    let loginRefreshToken: string;

    beforeAll(async () => {
      const res = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });
      loginRefreshToken = resBody<ApiResponse>(res).data.refreshToken as string;
    });

    it("returns new tokens with valid refresh token", async () => {
      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: loginRefreshToken });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("accessToken");
      expect(resBody<ApiResponse>(res).data).toHaveProperty("refreshToken");
    });

    it("rejects invalid refresh token", async () => {
      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-refresh-token" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects empty body", async () => {
      const res = await request(testApp).post("/api/auth/refresh").send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rotated refresh token invalidates previous one", async () => {
      const login = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });
      const rt1 = resBody<ApiResponse>(login).data.refreshToken as string;

      const refresh1 = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: rt1 });
      expect(refresh1.status).toBe(200);

      const reuse = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: rt1 });
      expect(reuse.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("logs out with valid token", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      const token = resBody<ApiResponse>(loginRes).data.accessToken as string;

      const res = await request(testApp)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("rejects logout without token", async () => {
      const res = await request(testApp).post("/api/auth/logout");

      expect(res.status).toBe(401);
    });
  });

  describe("session security", () => {
    it("refresh token is invalidated after logout", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      const { accessToken: at, refreshToken: rt } =
        resBody<ApiResponse>(loginRes).data;

      await request(testApp)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${at}`);

      const refreshRes = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: rt });

      expect(refreshRes.status).toBeGreaterThanOrEqual(400);
    });

    it("access token still works (stateless JWT) after logout", async () => {
      const loginRes = await request(testApp)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      const { accessToken: at } = resBody<ApiResponse>(loginRes).data;

      await request(testApp)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${at}`);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${at}`);

      expect(meRes.status).toBe(200);
    });
  });

  describe("POST /api/auth/client/register", () => {
    const clientPassword = "ClientPass123!";
    let tenantCompanyId = "";
    const clientPhone = `+1555${Date.now().toString().slice(-7)}`;

    beforeAll(async () => {
      const tenant = await createTestTenant();
      tenantCompanyId = tenant.company.id;
    });

    it("registers a client account and returns tokens", async () => {
      const res = await request(testApp)
        .post("/api/auth/client/register")
        .send({
          companyId: tenantCompanyId,
          fullName: "Client Register Test",
          phone: clientPhone,
          password: clientPassword,
          email: "client-register@test.com",
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("accessToken");
      expect(resBody<ApiResponse>(res).data).toHaveProperty("refreshToken");
      expect(
        resBody<ApiResponse<{ user: { phone: string } }>>(res).data.user.phone,
      ).toBe(clientPhone);
    });

    it("logs in with registered client credentials", async () => {
      const res = await request(testApp).post("/api/auth/client/login").send({
        companyId: tenantCompanyId,
        phone: clientPhone,
        password: clientPassword,
      });
      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data).toHaveProperty("accessToken");
    });
  });

  describe("POST /api/auth/client/request-otp + verify-otp", () => {
    let tenantCompanyId = "";
    const clientPhone = `+1666${Date.now().toString().slice(-7)}`;

    beforeAll(async () => {
      const tenant = await createTestTenant();
      tenantCompanyId = tenant.company.id;
      await request(testApp).post("/api/auth/client/register").send({
        companyId: tenantCompanyId,
        fullName: "Client OTP Test",
        phone: clientPhone,
        password: "OldPass123!",
      });
    });

    it("resets client password via OTP flow", async () => {
      const requestOtp = await request(testApp)
        .post("/api/auth/client/request-otp")
        .send({ companyId: tenantCompanyId, phone: clientPhone });

      expect(requestOtp.status).toBe(200);
      const devCode = resBody<ApiResponse>(requestOtp).data.devCode as string;
      expect(devCode).toHaveLength(6);

      const verify = await request(testApp)
        .post("/api/auth/client/verify-otp")
        .send({
          companyId: tenantCompanyId,
          phone: clientPhone,
          code: devCode,
          newPassword: "NewPass123!",
        });
      expect(verify.status).toBe(200);
      expect(resBody<ApiResponse>(verify).data.success).toBe(true);

      const login = await request(testApp).post("/api/auth/client/login").send({
        companyId: tenantCompanyId,
        phone: clientPhone,
        password: "NewPass123!",
      });
      expect(login.status).toBe(200);
    });
  });

  describe("client session security", () => {
    const password = "ClientSession123!";
    let tenantCompanyId = "";
    const clientPhone = `+1777${Date.now().toString().slice(-7)}`;

    beforeAll(async () => {
      const tenant = await createTestTenant();
      tenantCompanyId = tenant.company.id;
      await request(testApp).post("/api/auth/client/register").send({
        companyId: tenantCompanyId,
        fullName: "Client Session Test",
        phone: clientPhone,
        password,
      });
    });

    it("revokes client refresh token after client logout", async () => {
      const login = await request(testApp).post("/api/auth/client/login").send({
        companyId: tenantCompanyId,
        phone: clientPhone,
        password,
      });

      expect(login.status).toBe(200);
      const { accessToken, refreshToken } = resBody<ApiResponse>(login)
        .data as {
        accessToken: string;
        refreshToken: string;
      };

      const logout = await request(testApp)
        .post("/api/auth/client/logout")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(logout.status).toBe(200);

      const refresh = await request(testApp)
        .post("/api/auth/client/refresh")
        .send({ refreshToken });
      expect(refresh.status).toBe(401);
    });
  });
});
