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

describe("Provider API Key management — integration", () => {
  let owner: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Key Test Co" });
    owner = await createTestUser({
      email: `key-owner-${Date.now()}@test.com`,
    });
    await assignRole(owner.id, tenant.company.id, "owner", tenant.branch.id);
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h(user: TestUser = owner) {
    return authHeaders(user.token, tenant.company.id, tenant.branch.id);
  }

  // ─── POST /api/provider-api-keys ─────────────────────────────────────────

  describe("POST /api/provider-api-keys — key generation", () => {
    it("creates a new API key and returns the raw key once", async () => {
      const res = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "my_provider", name: "Test Integration Key" });

      expect(res.status).toBe(201);
      const key = resBody<ApiResponse>(res).data;
      expect(key).toHaveProperty("id");
      expect(key).toHaveProperty("rawKey");
      expect(typeof key.rawKey).toBe("string");
      expect((key.rawKey as string).startsWith("pk_")).toBe(true);
      expect(key.provider).toBe("my_provider");
      expect(key.name).toBe("Test Integration Key");
      expect(key.isActive).toBe(true);
      expect(key).not.toHaveProperty("keyHash");
    });

    it("returns 422 when provider is missing", async () => {
      const res = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ name: "No Provider Key" });

      expect(res.status).toBe(422);
    });

    it("returns 422 when name is missing", async () => {
      const res = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "my_provider" });

      expect(res.status).toBe(422);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/provider-api-keys")
        .set("x-company-id", tenant.company.id)
        .send({ provider: "my_provider", name: "Unauth Key" });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/provider-api-keys ──────────────────────────────────────────

  describe("GET /api/provider-api-keys — key listing", () => {
    it("returns a list of keys without exposing the raw key or hash", async () => {
      await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "list_provider", name: "Listed Key" });

      const res = await request(testApp).get("/api/provider-api-keys").set(h());

      expect(res.status).toBe(200);
      const keys = resBody<ApiResponse>(res).data as unknown as Array<
        Record<string, unknown>
      >;
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThanOrEqual(1);

      for (const key of keys) {
        expect(key).not.toHaveProperty("rawKey");
        expect(key).not.toHaveProperty("keyHash");
        expect(key).toHaveProperty("keyPrefix");
        expect(key).toHaveProperty("id");
        expect(key).toHaveProperty("provider");
        expect(key).toHaveProperty("isActive");
      }
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .get("/api/provider-api-keys")
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/provider-api-keys/:id ───────────────────────────────────

  describe("DELETE /api/provider-api-keys/:id — key revocation", () => {
    it("revokes a key and subsequent telemetry ingest returns 401", async () => {
      const createRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "revoke_provider", name: "Key To Revoke" });

      expect(createRes.status).toBe(201);
      const createdKey = resBody<ApiResponse>(createRes).data;
      const rawKey = createdKey.rawKey as string;
      const keyId = createdKey.id as string;

      const ingestBefore = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", rawKey)
        .send({
          provider: "revoke_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
        });
      expect(ingestBefore.status).not.toBe(401);

      const deleteRes = await request(testApp)
        .delete(`/api/provider-api-keys/${keyId}`)
        .set(h());

      expect(deleteRes.status).toBe(200);
      const revoked = resBody<ApiResponse>(deleteRes).data;
      expect(revoked.isActive).toBe(false);
      expect(revoked.revokedAt).toBeTruthy();

      const ingestAfter = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", rawKey)
        .send({
          provider: "revoke_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
        });

      expect(ingestAfter.status).toBe(401);
    });

    it("returns 404 when revoking a non-existent key id", async () => {
      const res = await request(testApp)
        .delete("/api/provider-api-keys/00000000-0000-0000-0000-000000000000")
        .set(h());

      expect(res.status).toBe(404);
    });

    it("returns 401 without authentication", async () => {
      const createRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "revoke_provider", name: "Auth Revoke Test Key" });

      expect(createRes.status).toBe(201);
      const keyId = resBody<ApiResponse>(createRes).data.id as string;

      const res = await request(testApp)
        .delete(`/api/provider-api-keys/${keyId}`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/provider-api-keys/:id/rotate ───────────────────────────────

  describe("POST /api/provider-api-keys/:id/rotate — key rotation", () => {
    it("creates a new active key and revokes the old one atomically, old key → 401, new key → 200", async () => {
      const createRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "rotate_provider", name: "Key To Rotate" });

      expect(createRes.status).toBe(201);
      const original = resBody<ApiResponse>(createRes).data;
      const oldRawKey = original.rawKey as string;
      const oldId = original.id as string;

      const ingestBefore = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", oldRawKey)
        .send({
          provider: "rotate_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
        });
      expect(ingestBefore.status).not.toBe(401);

      const rotateRes = await request(testApp)
        .post(`/api/provider-api-keys/${oldId}/rotate`)
        .set(h());

      expect(rotateRes.status).toBe(201);
      const rotated = resBody<ApiResponse>(rotateRes).data as Record<
        string,
        unknown
      >;
      expect(rotated.revokedId).toBe(oldId);
      const newKey = rotated.newKey as Record<string, unknown>;
      expect(newKey).toHaveProperty("id");
      expect(newKey.id).not.toBe(oldId);
      expect(newKey).toHaveProperty("rawKey");
      expect(typeof newKey.rawKey).toBe("string");
      expect((newKey.rawKey as string).startsWith("pk_")).toBe(true);
      expect(newKey.isActive).toBe(true);
      expect(newKey).not.toHaveProperty("keyHash");

      const ingestOld = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", oldRawKey)
        .send({
          provider: "rotate_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
        });
      expect(ingestOld.status).toBe(401);

      const ingestNew = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", newKey.rawKey as string)
        .send({
          provider: "rotate_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
        });
      expect(ingestNew.status).not.toBe(401);
    });

    it("preserves provider and name on the new key", async () => {
      const createRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "meta_provider", name: "Meta Test Key" });

      expect(createRes.status).toBe(201);
      const original = resBody<ApiResponse>(createRes).data;

      const rotateRes = await request(testApp)
        .post(`/api/provider-api-keys/${original.id as string}/rotate`)
        .set(h());

      expect(rotateRes.status).toBe(201);
      const rotated = resBody<ApiResponse>(rotateRes).data as Record<
        string,
        unknown
      >;
      const newKey = rotated.newKey as Record<string, unknown>;
      expect(newKey.provider).toBe("meta_provider");
      expect(newKey.name).toBe("Meta Test Key");
    });

    it("returns 404 when rotating a non-existent key id", async () => {
      const res = await request(testApp)
        .post(
          "/api/provider-api-keys/00000000-0000-0000-0000-000000000000/rotate",
        )
        .set(h());

      expect(res.status).toBe(404);
    });

    it("returns 404 when rotating an already-revoked key", async () => {
      const createRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "revoked_rotate_provider", name: "Already Revoked" });

      expect(createRes.status).toBe(201);
      const keyId = resBody<ApiResponse>(createRes).data.id as string;

      await request(testApp).delete(`/api/provider-api-keys/${keyId}`).set(h());

      const rotateRes = await request(testApp)
        .post(`/api/provider-api-keys/${keyId}/rotate`)
        .set(h());

      expect(rotateRes.status).toBe(404);
    });

    it("returns 401 without authentication", async () => {
      const createRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "auth_rotate_provider", name: "Auth Rotate Test" });

      expect(createRes.status).toBe(201);
      const keyId = resBody<ApiResponse>(createRes).data.id as string;

      const res = await request(testApp)
        .post(`/api/provider-api-keys/${keyId}/rotate`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────

  describe("Tenant isolation — key from company A cannot ingest for company B", () => {
    it("rejects telemetry for a device belonging to a different company", async () => {
      const tenantB = await createTestTenant({ companyName: "Other Co B" });
      const ownerB = await createTestUser({
        email: `key-owner-b-${Date.now()}@test.com`,
      });
      await assignRole(
        ownerB.id,
        tenantB.company.id,
        "owner",
        tenantB.branch.id,
      );

      const hB = authHeaders(
        ownerB.token,
        tenantB.company.id,
        tenantB.branch.id,
      );

      const createKeyRes = await request(testApp)
        .post("/api/provider-api-keys")
        .set(h())
        .send({ provider: "isolation_provider", name: "Company A Key" });

      expect(createKeyRes.status).toBe(201);
      const rawKeyA = resBody<ApiResponse>(createKeyRes).data.rawKey as string;

      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const externalIdB = `EXT-B-${suffix}`;

      const deviceRes = await request(testApp)
        .post("/api/devices")
        .set(hB)
        .send({
          deviceType: "gps_tracker",
          provider: "isolation_provider",
          externalId: externalIdB,
          branchId: tenantB.branch.id,
        });

      expect(deviceRes.status).toBe(201);

      const ingestRes = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", rawKeyA)
        .send({
          deviceExternalId: externalIdB,
          provider: "isolation_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
        });

      expect(ingestRes.status).toBe(200);
      const ingestBody = resBody<ApiResponse>(ingestRes).data as Record<
        string,
        unknown
      >;
      expect(ingestBody.status).toBe("skipped");
    });
  });
});
