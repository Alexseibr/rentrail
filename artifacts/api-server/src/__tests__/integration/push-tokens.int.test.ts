import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db, pushDeviceTokens } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  testApp,
  acquireTestLock,
  cleanDatabase,
  clearRolesCache,
  seedRolesAndPermissions,
  createTestUser,
  authHeaders,
  resBody,
  type ApiResponse,
  type TestUser,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

describe("Push Tokens — integration", () => {
  let _unlock: (() => void) | undefined;
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();

    userA = await createTestUser({
      email: `push-a-${Date.now()}@test.com`,
    });
    userB = await createTestUser({
      email: `push-b-${Date.now()}@test.com`,
    });
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  // ─── POST /api/push/register ──────────────────────────────────────────────────

  describe("POST /api/push/register", () => {
    it("returns 401 when no auth token is provided", async () => {
      const res = await request(testApp).post("/api/push/register").send({
        token: "ExponentPushToken[test-no-auth]",
        platform: "ios",
      });

      expect(res.status).toBe(401);
    });

    it("stores a new device token in the database", async () => {
      const pushToken = `ExponentPushToken[store-test-${Date.now()}]`;

      const res = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: pushToken, platform: "android" });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(data.token).toBe(pushToken);
      expect(data.userId).toBe(userA.id);
      expect(data.platform).toBe("android");

      const rows = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.token, pushToken));

      expect(rows.length).toBe(1);
      expect(rows[0].userId).toBe(userA.id);
    });

    it("stores optional fields (appVersion, deviceId) when provided", async () => {
      const pushToken = `ExponentPushToken[optional-${Date.now()}]`;

      const res = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({
          token: pushToken,
          platform: "ios",
          appVersion: "2.3.4",
          deviceId: "device-abc-123",
        });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(data.appVersion).toBe("2.3.4");
      expect(data.deviceId).toBe("device-abc-123");
    });

    it("returns 4xx for an invalid platform value", async () => {
      const res = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({
          token: `ExponentPushToken[bad-platform-${Date.now()}]`,
          platform: "windows",
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 4xx when the token field is missing", async () => {
      const res = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ platform: "ios" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("accepts 'web' as a valid platform value", async () => {
      const pushToken = `ExponentPushToken[web-${Date.now()}]`;

      const res = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: pushToken, platform: "web" });

      expect(res.status).toBe(200);
    });
  });

  // ─── Duplicate token upsert ───────────────────────────────────────────────────

  describe("POST /api/push/register — duplicate token upsert", () => {
    it("updates the userId when the same device token is registered by a different user", async () => {
      const sharedToken = `ExponentPushToken[shared-${Date.now()}]`;

      const firstRes = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: sharedToken, platform: "ios" });

      expect(firstRes.status).toBe(200);

      const secondRes = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userB.token))
        .send({ token: sharedToken, platform: "ios" });

      expect(secondRes.status).toBe(200);

      const rows = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.token, sharedToken));

      expect(rows.length).toBe(1);
      expect(rows[0].userId).toBe(userB.id);
    });

    it("keeps exactly one DB row after multiple registrations of the same token", async () => {
      const multiToken = `ExponentPushToken[multi-${Date.now()}]`;

      for (let i = 0; i < 3; i++) {
        await request(testApp)
          .post("/api/push/register")
          .set(authHeaders(userA.token))
          .send({ token: multiToken, platform: "android" });
      }

      const rows = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.token, multiToken));

      expect(rows.length).toBe(1);
    });

    it("updates platform when the same token re-registers with a different platform", async () => {
      const switchToken = `ExponentPushToken[switch-${Date.now()}]`;

      await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: switchToken, platform: "ios" });

      const res = await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: switchToken, platform: "android" });

      expect(res.status).toBe(200);

      const rows = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.token, switchToken));

      expect(rows.length).toBe(1);
      expect(rows[0].platform).toBe("android");
    });
  });

  // ─── POST /api/push/unregister ────────────────────────────────────────────────

  describe("POST /api/push/unregister", () => {
    it("returns 401 when no auth token is provided", async () => {
      const res = await request(testApp).post("/api/push/unregister").send({
        token: "ExponentPushToken[unregister-no-auth]",
      });

      expect(res.status).toBe(401);
    });

    it("removes a known token owned by the requesting user and returns 200", async () => {
      const pushToken = `ExponentPushToken[unregister-ok-${Date.now()}]`;

      await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: pushToken, platform: "ios" });

      const res = await request(testApp)
        .post("/api/push/unregister")
        .set(authHeaders(userA.token))
        .send({ token: pushToken });

      expect(res.status).toBe(200);

      const rows = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.token, pushToken));

      expect(rows.length).toBe(0);
    });

    it("returns 404 when the token belongs to a different user", async () => {
      const pushToken = `ExponentPushToken[unregister-ownership-${Date.now()}]`;

      await request(testApp)
        .post("/api/push/register")
        .set(authHeaders(userA.token))
        .send({ token: pushToken, platform: "android" });

      const res = await request(testApp)
        .post("/api/push/unregister")
        .set(authHeaders(userB.token))
        .send({ token: pushToken });

      expect(res.status).toBe(404);

      const rows = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.token, pushToken));

      expect(rows.length).toBe(1);
    });

    it("returns 404 when the token does not exist", async () => {
      const res = await request(testApp)
        .post("/api/push/unregister")
        .set(authHeaders(userA.token))
        .send({ token: "ExponentPushToken[does-not-exist]" });

      expect(res.status).toBe(404);
    });
  });
});
