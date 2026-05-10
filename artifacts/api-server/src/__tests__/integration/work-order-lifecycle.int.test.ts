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
  createTestAsset,
  assignRole,
  authHeaders,
  resBody,
  type TestUser,
  type TestTenant,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

describe("Work-order lifecycle — integration", () => {
  let admin: TestUser;
  let mechanic: TestUser;
  let tenant: TestTenant;
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    tenant = await createTestTenant({ companyName: "Work Order Int Co" });
    admin = await createTestUser({
      email: `wo-admin-${Date.now()}@test.com`,
    });
    mechanic = await createTestUser({
      email: `wo-mechanic-${Date.now()}@test.com`,
    });
    await assignRole(admin.id, tenant.company.id, "admin", tenant.branch.id);
    await assignRole(
      mechanic.id,
      tenant.company.id,
      "mechanic",
      tenant.branch.id,
    );
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  function h(user: TestUser = admin) {
    return authHeaders(user.token, tenant.company.id, tenant.branch.id);
  }

  async function createWorkOrder(overrides?: {
    title?: string;
    orderType?: string;
    assignedToUserId?: string;
    assetId?: string;
    priority?: string;
  }): Promise<string> {
    const res = await request(testApp)
      .post("/api/work-orders")
      .set(h())
      .send({
        title: overrides?.title ?? `WO-${Date.now()}`,
        orderType: overrides?.orderType ?? "field_repair",
        branchId: tenant.branch.id,
        assignedToUserId: overrides?.assignedToUserId,
        assetId: overrides?.assetId,
        priority: overrides?.priority,
      });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data.id as string;
  }

  async function createServiceRequest(): Promise<string> {
    const res = await request(testApp)
      .post("/api/service-requests")
      .set(h())
      .send({
        branchId: tenant.branch.id,
        requestType: "breakdown",
        title: `SR-${Date.now()}`,
        priority: "high",
      });
    expect(res.status).toBe(201);
    return resBody<ApiResponse>(res).data.id as string;
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  describe("GET /api/work-orders", () => {
    it("returns a list for the company", async () => {
      const res = await request(testApp).get("/api/work-orders").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .get("/api/work-orders")
        .set("x-company-id", tenant.company.id);

      expect(res.status).toBe(401);
    });

    it("returns 403 for user with no company role", async () => {
      const stranger = await createTestUser({
        email: `wo-stranger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });

      const res = await request(testApp)
        .get("/api/work-orders")
        .set(authHeaders(stranger.token, tenant.company.id));

      expect(res.status).toBe(403);
    });
  });

  // ─── Create ───────────────────────────────────────────────────────────────────

  describe("POST /api/work-orders", () => {
    it("creates a work order in draft status", async () => {
      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({
          title: "Replace brake pads",
          orderType: "workshop_repair",
          branchId: tenant.branch.id,
          priority: "high",
        });

      expect(res.status).toBe(201);
      const wo = resBody<ApiResponse>(res).data;
      expect(wo).toHaveProperty("id");
      expect(wo.status).toBe("draft");
      expect(wo.orderType).toBe("workshop_repair");
    });

    it("creates a work order with assigned mechanic", async () => {
      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({
          title: "Inspect wheel",
          orderType: "inspection",
          branchId: tenant.branch.id,
          assignedToUserId: mechanic.id,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.assignedToUserId).toBe(mechanic.id);
    });

    it("creates a work order linked to an asset", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        status: "maintenance",
      });

      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({
          title: "Asset repair",
          orderType: "field_repair",
          branchId: tenant.branch.id,
          assetId: asset.id,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.assetId).toBe(asset.id);
    });

    it("creates a work order linked to a service request", async () => {
      const srId = await createServiceRequest();

      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({
          title: "WO for SR",
          orderType: "field_repair",
          serviceRequestId: srId,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.serviceRequestId).toBe(srId);
    });

    it("returns 400 when title is missing", async () => {
      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({ orderType: "inspection" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when orderType is missing", async () => {
      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({ title: "No type" });

      expect(res.status).toBe(400);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(testApp)
        .post("/api/work-orders")
        .set("x-company-id", tenant.company.id)
        .send({ title: "Unauth WO", orderType: "inspection" });

      expect(res.status).toBe(401);
    });
  });

  // ─── Status transitions ───────────────────────────────────────────────────────

  describe("POST /api/work-orders/:id/status — full lifecycle", () => {
    it("transitions draft → assigned", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "assigned" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("assigned");
    });

    it("transitions assigned → en_route", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "assigned" });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "en_route" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("en_route");
    });

    it("transitions en_route → in_progress and sets startedAt", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "assigned" });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "en_route" });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("in_progress");
      expect(resBody<ApiResponse>(res).data.startedAt).toBeTruthy();
    });

    it("transitions in_progress → waiting_parts", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "assigned" });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "waiting_parts" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("waiting_parts");
    });

    it("completes a work order and records completion fields", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "assigned" });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({
          status: "completed",
          resolution: "Replaced brake cable",
          actualCost: "1500",
        });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("completed");
      expect(resBody<ApiResponse>(res).data.completedAt).toBeTruthy();
      expect(resBody<ApiResponse>(res).data.resolution).toBe(
        "Replaced brake cable",
      );
      expect(String(resBody<ApiResponse>(res).data.actualCost)).toMatch(
        /^1500/,
      );
    });

    it("cancels a work order from draft", async () => {
      const woId = await createWorkOrder();

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "canceled" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
    });

    it("cancels a work order from in_progress", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "assigned" });
      await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h())
        .send({ status: "canceled" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
    });

    it("mechanic can update work order status", async () => {
      const woId = await createWorkOrder({ assignedToUserId: mechanic.id });

      const res = await request(testApp)
        .post(`/api/work-orders/${woId}/status`)
        .set(h(mechanic))
        .send({ status: "assigned" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("assigned");
    });

    it("returns 404 for unknown work order id", async () => {
      const res = await request(testApp)
        .post("/api/work-orders/00000000-0000-0000-0000-000000000000/status")
        .set(h())
        .send({ status: "assigned" });

      expect(res.status).toBe(404);
    });
  });

  // ─── Patch ────────────────────────────────────────────────────────────────────

  describe("PATCH /api/work-orders/:id", () => {
    it("updates editable fields (title, description, priority)", async () => {
      const woId = await createWorkOrder();

      const res = await request(testApp)
        .patch(`/api/work-orders/${woId}`)
        .set(h())
        .send({
          title: "Updated Title",
          description: "Updated description",
          priority: "urgent",
        });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.title).toBe("Updated Title");
      expect(resBody<ApiResponse>(res).data.description).toBe(
        "Updated description",
      );
      expect(resBody<ApiResponse>(res).data.priority).toBe("urgent");
    });

    it("returns 400 when no valid fields are provided", async () => {
      const woId = await createWorkOrder();

      const res = await request(testApp)
        .patch(`/api/work-orders/${woId}`)
        .set(h())
        .send({ status: "completed" });

      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown work order id", async () => {
      const res = await request(testApp)
        .patch("/api/work-orders/00000000-0000-0000-0000-000000000000")
        .set(h())
        .send({ title: "Ghost WO" });

      expect(res.status).toBe(404);
    });
  });

  // ─── Assign ───────────────────────────────────────────────────────────────────

  describe("work order assignment", () => {
    it("can create work order and assign to mechanic via assignedToUserId", async () => {
      const res = await request(testApp)
        .post("/api/work-orders")
        .set(h())
        .send({
          title: "Assign Test WO",
          orderType: "inspection",
          assignedToUserId: mechanic.id,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.assignedToUserId).toBe(mechanic.id);
    });
  });

  // ─── Filtering ────────────────────────────────────────────────────────────────

  describe("GET /api/work-orders — filtering", () => {
    let woDraftId: string;
    let woInProgressId: string;
    let woCompletedId: string;

    beforeAll(async () => {
      woDraftId = await createWorkOrder({ title: "Filter Draft WO" });

      woInProgressId = await createWorkOrder({
        title: "Filter InProgress WO",
        assignedToUserId: mechanic.id,
      });
      await request(testApp)
        .post(`/api/work-orders/${woInProgressId}/status`)
        .set(h())
        .send({ status: "assigned" });
      await request(testApp)
        .post(`/api/work-orders/${woInProgressId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      woCompletedId = await createWorkOrder({
        title: "Filter Completed WO",
        assignedToUserId: mechanic.id,
      });
      await request(testApp)
        .post(`/api/work-orders/${woCompletedId}/status`)
        .set(h())
        .send({ status: "assigned" });
      await request(testApp)
        .post(`/api/work-orders/${woCompletedId}/status`)
        .set(h())
        .send({ status: "in_progress" });
      await request(testApp)
        .post(`/api/work-orders/${woCompletedId}/status`)
        .set(h())
        .send({ status: "completed", resolution: "Done" });
    }, HOOK_TIMEOUT);

    it("without filter — returns all work orders including all three", async () => {
      const res = await request(testApp).get("/api/work-orders").set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((wo) => wo.id);
      expect(ids).toContain(woDraftId);
      expect(ids).toContain(woInProgressId);
      expect(ids).toContain(woCompletedId);
    });

    it("status=draft — returns only draft work orders", async () => {
      const res = await request(testApp)
        .get("/api/work-orders?status=draft")
        .set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((wo) => wo.id);
      expect(ids).toContain(woDraftId);
      expect(ids).not.toContain(woInProgressId);
      expect(ids).not.toContain(woCompletedId);
    });

    it("status=in_progress — returns only in-progress work orders", async () => {
      const res = await request(testApp)
        .get("/api/work-orders?status=in_progress")
        .set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((wo) => wo.id);
      expect(ids).toContain(woInProgressId);
      expect(ids).not.toContain(woDraftId);
      expect(ids).not.toContain(woCompletedId);
    });

    it("status=completed — returns only completed work orders", async () => {
      const res = await request(testApp)
        .get("/api/work-orders?status=completed")
        .set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((wo) => wo.id);
      expect(ids).toContain(woCompletedId);
      expect(ids).not.toContain(woDraftId);
      expect(ids).not.toContain(woInProgressId);
    });

    it("all items returned for a status match that status field", async () => {
      const res = await request(testApp)
        .get("/api/work-orders?status=in_progress")
        .set(h());

      for (const wo of resBody<ApiResponse>(res).data as unknown as Array<{
        status: string;
      }>) {
        expect(wo.status).toBe("in_progress");
      }
    });

    it("assignedToUserId filter returns only mechanic's work orders", async () => {
      const res = await request(testApp)
        .get(`/api/work-orders?assignedToUserId=${mechanic.id}`)
        .set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((wo) => wo.id);
      expect(ids).toContain(woInProgressId);
      expect(ids).toContain(woCompletedId);
      expect(ids).not.toContain(woDraftId);
    });
  });

  // ─── Service requests ─────────────────────────────────────────────────────────

  describe("service request lifecycle", () => {
    it("creates a service request in 'new' status", async () => {
      const res = await request(testApp)
        .post("/api/service-requests")
        .set(h())
        .send({
          branchId: tenant.branch.id,
          requestType: "flat_tire",
          title: "Flat tyre SR",
          priority: "medium",
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.status).toBe("new");
      expect(resBody<ApiResponse>(res).data.title).toBe("Flat tyre SR");
    });

    it("assigns a service request", async () => {
      const srId = await createServiceRequest();

      const res = await request(testApp)
        .post(`/api/service-requests/${srId}/assign`)
        .set(h())
        .send({ assignedToUserId: mechanic.id });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("assigned");
      expect(resBody<ApiResponse>(res).data.assignedToUserId).toBe(mechanic.id);
    });

    it("advances service request from new → in_progress", async () => {
      const srId = await createServiceRequest();

      const res = await request(testApp)
        .post(`/api/service-requests/${srId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("in_progress");
    });

    it("completes a service request and sets resolvedAt", async () => {
      const srId = await createServiceRequest();
      await request(testApp)
        .post(`/api/service-requests/${srId}/status`)
        .set(h())
        .send({ status: "in_progress" });

      const res = await request(testApp)
        .post(`/api/service-requests/${srId}/status`)
        .set(h())
        .send({ status: "completed" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("completed");
      expect(resBody<ApiResponse>(res).data.resolvedAt).toBeTruthy();
    });

    it("cancels a service request", async () => {
      const srId = await createServiceRequest();

      const res = await request(testApp)
        .post(`/api/service-requests/${srId}/status`)
        .set(h())
        .send({ status: "canceled" });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.status).toBe("canceled");
    });

    it("returns 404 for unknown service request id", async () => {
      const res = await request(testApp)
        .get("/api/service-requests/00000000-0000-0000-0000-000000000000")
        .set(h());

      expect(res.status).toBe(404);
    });

    it("list returns 200 with all service requests", async () => {
      const res = await request(testApp).get("/api/service-requests").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("filters service requests by status", async () => {
      const srId = await createServiceRequest();

      const res = await request(testApp)
        .get("/api/service-requests?status=new")
        .set(h());

      expect(res.status).toBe(200);
      const ids = (
        resBody<ApiResponse>(res).data as unknown as Array<{ id: string }>
      ).map((sr) => sr.id);
      expect(ids).toContain(srId);
    });

    it("rejects invalid status filter with 400", async () => {
      const res = await request(testApp)
        .get("/api/service-requests?status=invalid_status")
        .set(h());

      expect(res.status).toBe(400);
    });
  });

  // ─── Maintenance logs ─────────────────────────────────────────────────────────

  describe("maintenance log lifecycle", () => {
    it("creates a maintenance log for an asset", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        status: "available",
      });

      const res = await request(testApp)
        .post("/api/maintenance-logs")
        .set(h())
        .send({
          assetId: asset.id,
          logType: "general_service",
          notes: "Oil changed, brakes adjusted",
          cost: 500,
        });

      expect(res.status).toBe(201);
      expect(resBody<ApiResponse>(res).data.assetId).toBe(asset.id);
      expect(resBody<ApiResponse>(res).data.logType).toBe("general_service");
    });

    it("returns maintenance log by id", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        status: "available",
      });
      const createRes = await request(testApp)
        .post("/api/maintenance-logs")
        .set(h())
        .send({
          assetId: asset.id,
          logType: "inspection",
          notes: "Checked all systems",
        });
      const logId = resBody<ApiResponse>(createRes).data.id as string;

      const res = await request(testApp)
        .get(`/api/maintenance-logs/${logId}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.id).toBe(logId);
    });

    it("returns 400 when assetId is missing", async () => {
      const res = await request(testApp)
        .post("/api/maintenance-logs")
        .set(h())
        .send({ logType: "routine_service" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when logType is missing", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        status: "available",
      });

      const res = await request(testApp)
        .post("/api/maintenance-logs")
        .set(h())
        .send({ assetId: asset.id });

      expect(res.status).toBe(400);
    });

    it("lists maintenance logs for the company", async () => {
      const res = await request(testApp).get("/api/maintenance-logs").set(h());

      expect(res.status).toBe(200);
      expect(Array.isArray(resBody<ApiResponse>(res).data)).toBe(true);
    });

    it("can update maintenance log notes and cost", async () => {
      const asset = await createTestAsset(tenant.company.id, tenant.branch.id, {
        status: "available",
      });
      const createRes = await request(testApp)
        .post("/api/maintenance-logs")
        .set(h())
        .send({ assetId: asset.id, logType: "other", notes: "Initial note" });
      const logId = resBody<ApiResponse>(createRes).data.id as string;

      const res = await request(testApp)
        .patch(`/api/maintenance-logs/${logId}`)
        .set(h())
        .send({ notes: "Updated note", cost: 750 });

      expect(res.status).toBe(200);
      expect(resBody<ApiResponse>(res).data.notes).toBe("Updated note");
    });
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────────

  describe("tenant isolation", () => {
    it("cannot read work orders from another company", async () => {
      const tenantB = await createTestTenant({
        companyName: "WO Isolation Co B",
      });
      const userB = await createTestUser({
        email: `wo-iso-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      });
      await assignRole(userB.id, tenantB.company.id, "admin");

      const woId = await createWorkOrder();

      const listRes = await request(testApp)
        .get("/api/work-orders")
        .set(authHeaders(userB.token, tenantB.company.id));

      expect(listRes.status).toBe(200);
      const ids = (listRes.body.data as Array<{ id: string }>).map(
        (wo) => wo.id,
      );
      expect(ids).not.toContain(woId);
    });
  });
});
