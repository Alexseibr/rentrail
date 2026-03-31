import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db, rentals } from "@workspace/db";
import { eq } from "drizzle-orm";
import { testApp } from "../../test/app";
import { cleanDatabase } from "../../test/setup";
import {
  createTestUser,
  createTestTenant,
  createTestClient,
  createTestAsset,
  assignRole,
  authHeaders,
  clearRolesCache,
  type TestUser,
  type TestTenant,
} from "../../test/helpers";
import { seedRolesAndPermissions } from "../../test/seed-rbac-inline";

describe("Rental Workflow API", () => {
  let admin: TestUser;
  let tenant: TestTenant;
  let client: Awaited<ReturnType<typeof createTestClient>>;

  beforeAll(async () => {
    clearRolesCache();
    await seedRolesAndPermissions();

    tenant = await createTestTenant({ companyName: "Workflow Co" });
    admin = await createTestUser({ email: `wf-admin-${Date.now()}@test.com` });
    await assignRole(admin.id, tenant.company.id, "admin");

    client = await createTestClient(tenant.company.id);
  }, 30000);

  function h() {
    return authHeaders(admin.token, tenant.company.id);
  }

  async function freshAsset(status = "available") {
    return createTestAsset(tenant.company.id, tenant.branch.id, {
      stationId: tenant.station.id,
      status,
    });
  }

  async function createRental(assetId?: string) {
    const asset = assetId ? { id: assetId } : await freshAsset();
    const res = await request(testApp)
      .post("/api/rentals")
      .set(h())
      .send({ clientId: client.id, assetId: asset.id, branchId: tenant.branch.id });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  async function forceRentalStatus(rentalId: string, status: string) {
    await db.update(rentals).set({ status: status as any }).where(eq(rentals.id, rentalId));
  }

  describe("full lifecycle: create → approve → start → extend → return", () => {
    let rentalId: string;
    let assetId: string;

    it("create rental (draft)", async () => {
      const asset = await freshAsset();
      assetId = asset.id;

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client.id, assetId: asset.id, branchId: tenant.branch.id });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("draft");
      rentalId = res.body.data.id;
    });

    it("approve rental (draft → awaiting_payment)", async () => {
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/approve`)
        .set(h());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("awaiting_payment");
    });

    it("start rental (awaiting_pickup → active)", async () => {
      await forceRentalStatus(rentalId, "awaiting_pickup");

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/start`)
        .set(h());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("active");
    });

    it("asset becomes rented after start", async () => {
      const res = await request(testApp)
        .get(`/api/assets/${assetId}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("rented");
    });

    it("extend rental (active → extended)", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/extend`)
        .set(h())
        .send({ newEndDate: futureDate, reason: "Customer requested" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("extended");
    });

    it("return rental (extended → completed)", async () => {
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/return`)
        .set(h())
        .send({
          returnedToStationId: tenant.station.id,
          assetReturnStatus: "available",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("completed");
    });

    it("asset reverts to available after return", async () => {
      const res = await request(testApp)
        .get(`/api/assets/${assetId}`)
        .set(h());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("available");
    });

    it("rental status history is complete", async () => {
      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/status-history`)
        .set(h());

      expect(res.status).toBe(200);
      const statuses = res.body.data.map((e: { toStatus: string }) => e.toStatus);
      expect(statuses).toContain("draft");
      expect(statuses).toContain("active");
      expect(statuses).toContain("completed");
    });
  });

  describe("cancellation flow", () => {
    it("cancel draft rental", async () => {
      const rental = await createRental();

      const cancel = await request(testApp)
        .post(`/api/rentals/${rental.id}/cancel`)
        .set(h())
        .send({ reason: "Customer changed mind" });

      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe("canceled");
    });

    it("cancel active rental rolls back asset to available", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);

      await forceRentalStatus(rental.id, "awaiting_pickup");
      await request(testApp).post(`/api/rentals/${rental.id}/start`).set(h());

      const assetCheck = await request(testApp).get(`/api/assets/${asset.id}`).set(h());
      expect(assetCheck.body.data.status).toBe("rented");

      const cancel = await request(testApp)
        .post(`/api/rentals/${rental.id}/cancel`)
        .set(h())
        .send({ reason: "Emergency" });

      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe("canceled");

      const assetAfter = await request(testApp).get(`/api/assets/${asset.id}`).set(h());
      expect(assetAfter.body.data.status).toBe("available");
    });

    it("cancel awaiting_payment rental", async () => {
      const rental = await createRental();

      await request(testApp).post(`/api/rentals/${rental.id}/approve`).set(h());

      const cancel = await request(testApp)
        .post(`/api/rentals/${rental.id}/cancel`)
        .set(h())
        .send({});

      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe("canceled");
    });
  });

  describe("invalid status transitions", () => {
    it("cannot start a draft rental (must go through awaiting_pickup)", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id}/start`)
        .set(h());

      expect(res.status).toBe(422);
    });

    it("cannot return a draft rental", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id}/return`)
        .set(h())
        .send({});

      expect(res.status).toBe(422);
    });

    it("cannot approve a completed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);

      await forceRentalStatus(rental.id, "awaiting_pickup");
      await request(testApp).post(`/api/rentals/${rental.id}/start`).set(h());
      await request(testApp).post(`/api/rentals/${rental.id}/return`).set(h()).send({});

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id}/approve`)
        .set(h());

      expect(res.status).toBe(422);
    });

    it("cannot cancel a completed rental", async () => {
      const asset = await freshAsset();
      const rental = await createRental(asset.id);

      await forceRentalStatus(rental.id, "awaiting_pickup");
      await request(testApp).post(`/api/rentals/${rental.id}/start`).set(h());
      await request(testApp).post(`/api/rentals/${rental.id}/return`).set(h()).send({});

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id}/cancel`)
        .set(h())
        .send({});

      expect(res.status).toBe(422);
    });

    it("cannot extend a draft rental", async () => {
      const rental = await createRental();

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id}/extend`)
        .set(h())
        .send({ newEndDate: new Date(Date.now() + 86400000).toISOString() });

      expect(res.status).toBe(422);
    });
  });

  describe("asset conflict prevention", () => {
    it("cannot create second rental for asset with active rental", async () => {
      const asset = await freshAsset();
      await createRental(asset.id);

      const client2 = await createTestClient(tenant.company.id);
      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client2.id, assetId: asset.id, branchId: tenant.branch.id });

      expect(res.status).toBe(409);
    });

    it("cannot create rental for maintenance asset", async () => {
      const asset = await freshAsset("maintenance");

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client.id, assetId: asset.id, branchId: tenant.branch.id });

      expect(res.status).toBe(422);
    });

    it("cannot create rental for retired asset", async () => {
      const asset = await freshAsset("retired");

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client.id, assetId: asset.id, branchId: tenant.branch.id });

      expect(res.status).toBe(422);
    });
  });

  describe("asset status transitions via API", () => {
    it("available → maintenance → available", async () => {
      const asset = await freshAsset();

      const toMaint = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "maintenance", reason: "Scheduled check" });
      expect(toMaint.status).toBe(200);
      expect(toMaint.body.data.status).toBe("maintenance");

      const toAvail = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "available", reason: "Repair done" });
      expect(toAvail.status).toBe(200);
      expect(toAvail.body.data.status).toBe("available");
    });

    it("cannot transition retired asset to available", async () => {
      const asset = await freshAsset("draft");

      await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "retired", reason: "End of life" });

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "available", reason: "Trying to revive" });

      expect(res.status).toBe(422);
    });

    it("invalid direct transition is rejected (available → overdue)", async () => {
      const asset = await freshAsset();

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "overdue", reason: "Direct skip" });

      expect(res.status).toBe(422);
    });

    it("asset status history is recorded", async () => {
      const asset = await freshAsset();

      await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "maintenance", reason: "Check" });

      await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "available", reason: "Done" });

      const history = await request(testApp)
        .get(`/api/assets/${asset.id}/status-history`)
        .set(h());

      expect(history.status).toBe(200);
      expect(history.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("asset archive / restore", () => {
    it("archive and restore an asset", async () => {
      const asset = await freshAsset();

      const archive = await request(testApp)
        .post(`/api/assets/${asset.id}/archive`)
        .set(h());
      expect(archive.status).toBe(200);

      const restore = await request(testApp)
        .post(`/api/assets/${asset.id}/restore`)
        .set(h());
      expect(restore.status).toBe(200);
    });

    it("cannot change status of archived asset", async () => {
      const asset = await freshAsset();

      await request(testApp).post(`/api/assets/${asset.id}/archive`).set(h());

      const res = await request(testApp)
        .post(`/api/assets/${asset.id}/status`)
        .set(h())
        .send({ status: "maintenance", reason: "test" });

      expect(res.status).toBe(422);
    });

    it("cannot create rental for archived asset", async () => {
      const asset = await freshAsset();
      await request(testApp).post(`/api/assets/${asset.id}/archive`).set(h());

      const res = await request(testApp)
        .post("/api/rentals")
        .set(h())
        .send({ clientId: client.id, assetId: asset.id, branchId: tenant.branch.id });

      expect(res.status).toBe(422);
    });
  });

  describe("return station validation", () => {
    it("rejects return to station from another company", async () => {
      const tenant2 = await createTestTenant({ companyName: "Other Co" });
      const asset = await freshAsset();
      const rental = await createRental(asset.id);

      await forceRentalStatus(rental.id, "awaiting_pickup");
      await request(testApp).post(`/api/rentals/${rental.id}/start`).set(h());

      const res = await request(testApp)
        .post(`/api/rentals/${rental.id}/return`)
        .set(h())
        .send({ returnedToStationId: tenant2.station.id });

      expect(res.status).toBe(400);
    });
  });
});
