import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";

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
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.email).toBe(testEmail);
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
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");
      expect(typeof res.body.data.accessToken).toBe("string");
      expect(typeof res.body.data.refreshToken).toBe("string");
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
      freshToken = res.body.data.accessToken;
    });

    it("returns current user with valid token", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${freshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testEmail);
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
      loginRefreshToken = res.body.data.refreshToken;
    });

    it("returns new tokens with valid refresh token", async () => {
      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken: loginRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");
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
      const rt1 = login.body.data.refreshToken;

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

      const token = loginRes.body.data.accessToken;

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

      const { accessToken: at, refreshToken: rt } = loginRes.body.data;

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

      const { accessToken: at } = loginRes.body.data;

      await request(testApp)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${at}`);

      const meRes = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${at}`);

      expect(meRes.status).toBe(200);
    });
  });
});
