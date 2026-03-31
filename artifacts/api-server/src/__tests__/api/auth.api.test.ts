import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { testApp } from "../../test/app";
import { cleanDatabase } from "../../test/setup";

describe("Auth API", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  const testEmail = `auth-test-${Date.now()}@test.com`;
  const testPassword = "SecurePass123!";
  let accessToken: string;
  let refreshToken: string;

  describe("POST /api/auth/register", () => {
    it("creates a new user", async () => {
      const res = await request(testApp)
        .post("/api/auth/register")
        .send({
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
      const res = await request(testApp)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          password: testPassword,
          firstName: "Dup",
          lastName: "User",
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects short password", async () => {
      const res = await request(testApp)
        .post("/api/auth/register")
        .send({
          email: "short@test.com",
          password: "123",
          firstName: "Short",
          lastName: "Pass",
        });

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

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
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
  });

  describe("GET /api/auth/me", () => {
    it("returns current user with valid token", async () => {
      const res = await request(testApp)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

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
  });

  describe("POST /api/auth/refresh", () => {
    it("returns new tokens with valid refresh token", async () => {
      const res = await request(testApp)
        .post("/api/auth/refresh")
        .send({ refreshToken });

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
  });
});
