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
import { generateApiKey } from "../../services/provider-key.service";

const HOOK_TIMEOUT = 30_000;

const SQUARE_POLYGON = {
  type: "Polygon",
  coordinates: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ],
};

describe("IoT / Telemetry / Geofence — integration", () => {
  let owner: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;
  let providerApiKey: string;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "IoT Test Co" });
    owner = await createTestUser({
      email: `iot-owner-${Date.now()}@test.com`,
    });
    await assignRole(owner.id, tenant.company.id, "owner", tenant.branch.id);

    const keyRecord = await generateApiKey(tenant.company.id, {
      provider: "test_provider",
      name: "Integration Test Key",
    });
    providerApiKey = keyRecord.rawKey;
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h(user: TestUser = owner) {
    return authHeaders(user.token, tenant.company.id, tenant.branch.id);
  }

  async function createDevice(overrides?: {
    externalId?: string;
    provider?: string;
    deviceType?: string;
  }): Promise<string> {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await request(testApp)
      .post("/api/devices")
      .set(h())
      .send({
        deviceType: overrides?.deviceType ?? "gps_tracker",
        provider: overrides?.provider ?? "test_provider",
        externalId: overrides?.externalId ?? `EXT-${suffix}`,
        branchId: tenant.branch.id,
      });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data.id as string;
  }

  async function createGeofence(overrides?: {
    name?: string;
    type?: string;
    geometry?: unknown;
    rules?: unknown;
  }): Promise<string> {
    const res = await request(testApp)
      .post("/api/geofences")
      .set(h())
      .send({
        name: overrides?.name ?? `Zone-${Date.now()}`,
        type: overrides?.type ?? "operating_zone",
        geometry: overrides?.geometry ?? SQUARE_POLYGON,
        rules: overrides?.rules,
      });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data.id as string;
  }

  // ─── Device registration ───────────────────────────────────────────────────

  describe("POST /api/devices — IoT device registration", () => {
    it("creates a GPS tracker and returns the persisted record", async () => {
      const suffix = `${Date.now()}`;
      const res = await request(testApp)
        .post("/api/devices")
        .set(h())
        .send({
          deviceType: "gps_tracker",
          provider: "test_provider",
          externalId: `EXT-CREATE-${suffix}`,
          serialNumber: `SN-${suffix}`,
          imei: "123456789012345",
          branchId: tenant.branch.id,
        });

      expect(res.status).toBe(201);
      const device = resBody<ApiResponse>(res).data;
      expect(device).toHaveProperty("id");
      expect(device.deviceType).toBe("gps_tracker");
      expect(device.provider).toBe("test_provider");
      expect(device.status).toBe("draft");
      expect(device.imei).toBe("123456789012345");
    });

    it("returns 422 when deviceType is missing", async () => {
      const res = await request(testApp).post("/api/devices").set(h()).send({
        provider: "test_provider",
        externalId: "EXT-NO-TYPE",
      });

      expect(res.status).toBe(422);
    });

    it("returns 422 when provider is missing", async () => {
      const res = await request(testApp).post("/api/devices").set(h()).send({
        deviceType: "gps_tracker",
        externalId: "EXT-NO-PROVIDER",
      });

      expect(res.status).toBe(422);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/devices")
        .set("x-company-id", tenant.company.id)
        .send({
          deviceType: "gps_tracker",
          provider: "test_provider",
          externalId: "EXT-UNAUTH",
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── Device list and get ───────────────────────────────────────────────────

  describe("GET /api/devices — device listing", () => {
    it("returns a list of devices for the company", async () => {
      await createDevice();

      const res = await request(testApp).get("/api/devices").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("filters by deviceType", async () => {
      const externalId = `EXT-LOCK-${Date.now()}`;
      await request(testApp).post("/api/devices").set(h()).send({
        deviceType: "smart_lock",
        provider: "test_provider",
        externalId,
        branchId: tenant.branch.id,
      });

      const res = await request(testApp)
        .get("/api/devices?deviceType=smart_lock")
        .set(h());

      expect(res.status).toBe(200);
      const list = resBody<ApiResponse>(res).data as unknown as Array<{
        deviceType: string;
      }>;
      expect(list.every((d) => d.deviceType === "smart_lock")).toBe(true);
    });

    it("returns 400 for an invalid deviceType filter", async () => {
      const res = await request(testApp)
        .get("/api/devices?deviceType=laser_cannon")
        .set(h());

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid status filter", async () => {
      const res = await request(testApp)
        .get("/api/devices?status=flying")
        .set(h());

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/devices/:id — device detail", () => {
    it("returns a specific device by id", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .get(`/api/devices/${deviceId}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(deviceId);
    });

    it("returns 404 for an unknown device id", async () => {
      const res = await request(testApp)
        .get("/api/devices/00000000-0000-0000-0000-000000000000")
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  // ─── Device status machine ─────────────────────────────────────────────────

  describe("POST /api/devices/:id/change-status — status transitions", () => {
    it("transitions draft → active", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("active");
    });

    it("transitions active → maintenance", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "maintenance" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("maintenance");
    });

    it("returns 422 for invalid status value", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "exploded" });

      expect(res.status).toBe(422);
    });
  });

  // ─── Telemetry ingestion ───────────────────────────────────────────────────

  describe("POST /api/telemetry/ingest — telemetry ingestion", () => {
    it("ingests a telemetry packet for a known device (by externalId)", async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const externalId = `EXT-TELEM-${suffix}`;
      await request(testApp).post("/api/devices").set(h()).send({
        deviceType: "gps_tracker",
        provider: "test_provider",
        externalId,
        branchId: tenant.branch.id,
      });

      const res = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({
          deviceExternalId: externalId,
          provider: "test_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.75,
          lng: 37.62,
          speed: 15,
          batteryPercent: 85,
          lockState: "locked",
        });

      expect(res.status).toBe(200);
      const result = resBody<ApiResponse>(res).data;
      expect(result).toBeDefined();
    });

    it("ingests a packet by deviceId (internal UUID)", async () => {
      const deviceId = await createDevice();

      await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      const res = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({
          deviceId,
          provider: "test_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.8,
          lng: 37.7,
          speed: 10,
          batteryPercent: 72,
        });

      expect(res.status).toBe(200);
    });

    it("stores location and makes it retrievable via /telemetry/devices/:id/latest", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({
          deviceId,
          provider: "test_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.9,
          lng: 37.5,
          speed: 20,
          batteryPercent: 60,
        });

      const res = await request(testApp)
        .get(`/api/telemetry/devices/${deviceId}/latest`)
        .set(h());

      expect(res.status).toBe(200);
      const snap = resBody<ApiResponse>(res).data;
      expect(Number(snap.lat)).toBeCloseTo(55.9, 2);
      expect(Number(snap.lng)).toBeCloseTo(37.5, 2);
    });

    it("returns 401 when x-api-key header is missing", async () => {
      const res = await request(testApp).post("/api/telemetry/ingest").send({
        provider: "test_provider",
        recordedAt: new Date().toISOString(),
        lat: 55.0,
        lng: 37.0,
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 for an invalid API key", async () => {
      const res = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", "pk_invalid_key_that_does_not_exist")
        .send({
          provider: "test_provider",
          recordedAt: new Date().toISOString(),
          lat: 55.0,
          lng: 37.0,
        });

      expect(res.status).toBe(401);
    });

    it("returns 422 when recordedAt is missing", async () => {
      const res = await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({
          provider: "test_provider",
          lat: 55.0,
          lng: 37.0,
        });

      expect(res.status).toBe(422);
    });
  });

  // ─── Geofence CRUD ────────────────────────────────────────────────────────

  describe("POST /api/geofences — geofence creation", () => {
    it("creates an operating zone geofence", async () => {
      const res = await request(testApp).post("/api/geofences").set(h()).send({
        name: "Main Operating Zone",
        type: "operating_zone",
        geometry: SQUARE_POLYGON,
      });

      expect(res.status).toBe(201);
      const geo = resBody<ApiResponse>(res).data;
      expect(geo).toHaveProperty("id");
      expect(geo.name).toBe("Main Operating Zone");
      expect(geo.type).toBe("operating_zone");
      expect(geo.isActive).toBe(true);
    });

    it("creates a no-ride zone with rules", async () => {
      const res = await request(testApp)
        .post("/api/geofences")
        .set(h())
        .send({
          name: "Park No-Ride Zone",
          type: "no_ride_zone",
          geometry: SQUARE_POLYGON,
          rules: { maxSpeedKmh: 0 },
        });

      expect(res.status).toBe(201);
      const geo = resBody<ApiResponse>(res).data;
      expect(geo.type).toBe("no_ride_zone");
    });

    it("returns 422 when name is missing", async () => {
      const res = await request(testApp).post("/api/geofences").set(h()).send({
        type: "operating_zone",
        geometry: SQUARE_POLYGON,
      });

      expect(res.status).toBe(422);
    });

    it("returns 422 when type is invalid", async () => {
      const res = await request(testApp).post("/api/geofences").set(h()).send({
        name: "Bad Type Zone",
        type: "danger_zone",
        geometry: SQUARE_POLYGON,
      });

      expect(res.status).toBe(422);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/geofences")
        .set("x-company-id", tenant.company.id)
        .send({
          name: "Unauth Zone",
          type: "operating_zone",
          geometry: SQUARE_POLYGON,
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/geofences — geofence listing", () => {
    it("returns the list of active geofences for the company", async () => {
      await createGeofence({ name: "List Test Zone" });

      const res = await request(testApp).get("/api/geofences").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("filters by type", async () => {
      await createGeofence({ type: "return_zone", name: "Return Zone Alpha" });

      const res = await request(testApp)
        .get("/api/geofences?type=return_zone")
        .set(h());

      expect(res.status).toBe(200);
      const list = resBody<ApiResponse>(res).data as unknown as Array<{
        type: string;
      }>;
      expect(list.every((g) => g.type === "return_zone")).toBe(true);
    });

    it("isActive=true excludes archived geofences", async () => {
      const geoId = await createGeofence({ name: "To Be Archived Zone" });
      await request(testApp).post(`/api/geofences/${geoId}/archive`).set(h());

      const res = await request(testApp)
        .get("/api/geofences?isActive=true")
        .set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((g) => g.id);
      expect(ids).not.toContain(geoId);
    });
  });

  describe("GET /api/geofences/:id — geofence detail", () => {
    it("returns a specific geofence by id", async () => {
      const geoId = await createGeofence({ name: "Detail Zone" });

      const res = await request(testApp)
        .get(`/api/geofences/${geoId}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(geoId);
      expect(resBody<ApiResponse>(res).data.name).toBe("Detail Zone");
    });

    it("returns 404 for an unknown geofence id", async () => {
      const res = await request(testApp)
        .get("/api/geofences/00000000-0000-0000-0000-000000000000")
        .set(h());

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/geofences/:id — geofence update", () => {
    it("updates the geofence name", async () => {
      const geoId = await createGeofence({ name: "Original Name" });

      const res = await request(testApp)
        .patch(`/api/geofences/${geoId}`)
        .set(h())
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.name).toBe("Updated Name");
    });

    it("deactivates a geofence via isActive: false", async () => {
      const geoId = await createGeofence({ name: "To Be Deactivated" });

      const res = await request(testApp)
        .patch(`/api/geofences/${geoId}`)
        .set(h())
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.isActive).toBe(false);
    });
  });

  describe("POST /api/geofences/:id/archive — geofence deletion", () => {
    it("archives a geofence and sets archivedAt", async () => {
      const geoId = await createGeofence({ name: "Archivable Zone" });

      const res = await request(testApp)
        .post(`/api/geofences/${geoId}/archive`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.archivedAt).toBeTruthy();
      expect(resBody<ApiResponse>(res).data.isActive).toBe(false);
    });

    it("returns 409 when archiving an already-archived geofence", async () => {
      const geoId = await createGeofence({ name: "Double Archive Zone" });
      await request(testApp).post(`/api/geofences/${geoId}/archive`).set(h());

      const res = await request(testApp)
        .post(`/api/geofences/${geoId}/archive`)
        .set(h());

      expect(res.status).toBe(409);
    });
  });

  // ─── Geofence trigger detection ────────────────────────────────────────────

  describe("Geofence trigger detection via telemetry ingestion", () => {
    it("records a geofence_enter event when telemetry lands inside an active zone", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      await createGeofence({
        name: "Trigger Zone",
        type: "operating_zone",
        geometry: {
          type: "Polygon",
          coordinates: [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        },
      });

      await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({
          deviceId,
          provider: "test_provider",
          recordedAt: new Date().toISOString(),
          lat: 5,
          lng: 5,
        });

      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      const eventsRes = await request(testApp)
        .get(`/api/telemetry/devices/${deviceId}/events`)
        .set(h());

      expect(eventsRes.status).toBe(200);
      const events = eventsRes.body.data as unknown as Array<{
        eventType: string;
      }>;

      const enterEvents = events.filter(
        (e) => e.eventType === "geofence_enter",
      );
      expect(enterEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("does not record a geofence_enter event for a point outside all zones", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      await createGeofence({
        name: "Small Zone Far Away",
        type: "operating_zone",
        geometry: {
          type: "Polygon",
          coordinates: [
            [100, 100],
            [101, 100],
            [101, 101],
            [100, 101],
            [100, 100],
          ],
        },
      });

      await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({
          deviceId,
          provider: "test_provider",
          recordedAt: new Date().toISOString(),
          lat: -55,
          lng: -37,
        });

      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      const eventsRes = await request(testApp)
        .get(`/api/telemetry/devices/${deviceId}/events`)
        .set(h());

      expect(eventsRes.status).toBe(200);
      const events = eventsRes.body.data as unknown as Array<{
        eventType: string;
      }>;
      const enterEvents = events.filter(
        (e) => e.eventType === "geofence_enter",
      );
      expect(enterEvents.length).toBe(0);
    });

    it("does not fire duplicate geofence_enter events within the debounce window", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/change-status`)
        .set(h())
        .send({ status: "active" });

      await createGeofence({
        name: "Debounce Zone",
        type: "operating_zone",
        geometry: {
          type: "Polygon",
          coordinates: [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
            [20, 20],
          ],
        },
      });

      const payload = {
        deviceId,
        provider: "test_provider",
        recordedAt: new Date().toISOString(),
        lat: 25,
        lng: 25,
      };

      await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send(payload);

      await request(testApp)
        .post("/api/telemetry/ingest")
        .set("x-api-key", providerApiKey)
        .send({ ...payload, recordedAt: new Date().toISOString() });

      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      const eventsRes = await request(testApp)
        .get(`/api/telemetry/devices/${deviceId}/events`)
        .set(h());

      const events = eventsRes.body.data as unknown as Array<{
        eventType: string;
      }>;
      const enterEvents = events.filter(
        (e) => e.eventType === "geofence_enter",
      );
      expect(enterEvents.length).toBe(1);
    });
  });

  // ─── Remote command queuing ────────────────────────────────────────────────

  describe("POST /api/devices/:id/commands — command queuing", () => {
    it("enqueues a lock command for a device", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "lock" });

      expect(res.status).toBe(201);
      const cmd = resBody<ApiResponse>(res).data;
      expect(cmd).toHaveProperty("id");
      expect(cmd.commandType).toBe("lock");
      expect(cmd.status).toBe("queued");
    });

    it("enqueues an unlock command for a device", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "unlock" });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.commandType).toBe("unlock");
    });

    it("enqueues a locate command with optional payload", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "locate", payload: { accuracy: "high" } });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.commandType).toBe("locate");
    });

    it("returns 422 for an invalid commandType", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "self_destruct" });

      expect(res.status).toBe(422);
    });

    it("returns 401 without authentication", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set("x-company-id", tenant.company.id)
        .send({ commandType: "lock" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/devices/:id/commands — command queue retrieval", () => {
    it("returns the list of queued commands for a device", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "ping" });

      const res = await request(testApp)
        .get(`/api/devices/${deviceId}/commands`)
        .set(h());

      expect(res.status).toBe(200);
      const cmds = resBody<ApiResponse>(res).data as unknown as Array<{
        commandType: string;
        status: string;
      }>;
      expect(Array.isArray(cmds)).toBe(true);
      expect(cmds.some((c) => c.commandType === "ping")).toBe(true);
    });

    it("returns an empty list for a device with no commands", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .get(`/api/devices/${deviceId}/commands`)
        .set(h());

      expect(res.status).toBe(200);
      expect(
        resBody<ApiResponse>(res).data as unknown as unknown[],
      ).toHaveLength(0);
    });

    it("returns an empty list for an unknown device id", async () => {
      const res = await request(testApp)
        .get("/api/devices/00000000-0000-0000-0000-000000000000/commands")
        .set(h());

      expect(res.status).toBe(200);
      expect(
        resBody<ApiResponse>(res).data as unknown as unknown[],
      ).toHaveLength(0);
    });

    it("returns 401 without authentication", async () => {
      const deviceId = await createDevice();

      const res = await request(testApp)
        .get(`/api/devices/${deviceId}/commands`)
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("newly enqueued command appears in device command list", async () => {
      const deviceId = await createDevice();
      await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "arm_alarm" });
      await request(testApp)
        .post(`/api/devices/${deviceId}/commands`)
        .set(h())
        .send({ commandType: "disarm_alarm" });

      const res = await request(testApp)
        .get(`/api/devices/${deviceId}/commands`)
        .set(h());

      expect(res.status).toBe(200);
      const cmds = resBody<ApiResponse>(res).data as unknown as Array<{
        commandType: string;
      }>;
      const types = cmds.map((c) => c.commandType);
      expect(types).toContain("arm_alarm");
      expect(types).toContain("disarm_alarm");
    });
  });
});
