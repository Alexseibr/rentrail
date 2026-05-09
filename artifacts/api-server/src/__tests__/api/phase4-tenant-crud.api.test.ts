import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { testApp } from "../../test/app";
import {
  createTestUser,
  createTestTenant,
  assignRole,
} from "../../test/helpers";
import { db } from "@workspace/db";
import { rentals } from "@workspace/db/schema";

type _RB = {
  data: Record<string, unknown>;
  error: { code: string; message: string };
};
function rb(r: { body: unknown }): _RB {
  return r.body as _RB;
}

interface TenantContext {
  company: { id: string };
  branch: { id: string };
  station: { id: string };
  ownerToken: string;
}

let tenantA: TenantContext;
let tenantB: TenantContext;

async function setupTenantWithOwner(): Promise<TenantContext> {
  const tenant = await createTestTenant();
  const user = await createTestUser({});
  await assignRole(user.id, tenant.company.id, "owner", tenant.branch.id);
  return {
    company: tenant.company,
    branch: tenant.branch,
    station: tenant.station,
    ownerToken: user.token,
  };
}

beforeAll(async () => {
  tenantA = await setupTenantWithOwner();
  tenantB = await setupTenantWithOwner();
});

describe("Phase 4 — Core Tenant CRUD", () => {
  describe("branches lifecycle", () => {
    let branchId: string;

    it("creates a branch", async () => {
      const res = await request(testApp)
        .post("/api/branches")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ name: "Downtown Branch", city: "Madrid", country: "ES" });

      expect(res.status).toBe(201);
      expect(rb(res).data.name).toBe("Downtown Branch");
      branchId = rb(res).data.id as string;
    });

    it("lists branches (tenant-scoped)", async () => {
      const res = await request(testApp)
        .get("/api/branches")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(
        (rb(res).data as unknown as Array<Record<string, unknown>>).length,
      ).toBeGreaterThanOrEqual(1);
      for (const b of rb(res).data as unknown as Array<
        Record<string, unknown>
      >) {
        expect(b.companyId).toBe(tenantA.company.id);
      }
    });

    it("other tenant cannot see these branches", async () => {
      const res = await request(testApp)
        .get(`/api/branches/${branchId}`)
        .set("Authorization", `Bearer ${tenantB.ownerToken}`)
        .set("x-company-id", tenantB.company.id);

      expect(res.status).toBe(404);
    });

    it("deactivates a branch", async () => {
      const res = await request(testApp)
        .post(`/api/branches/${branchId}/deactivate`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("inactive");
    });

    it("rejects double deactivation", async () => {
      const res = await request(testApp)
        .post(`/api/branches/${branchId}/deactivate`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(422);
    });

    it("activates a branch", async () => {
      const res = await request(testApp)
        .post(`/api/branches/${branchId}/activate`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("active");
    });
  });

  describe("clients lifecycle", () => {
    let clientId: string;

    it("creates a client", async () => {
      const res = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          fullName: "John Doe",
          email: "john@test.com",
          phone: "+34600000001",
        });

      expect(res.status).toBe(201);
      clientId = rb(res).data.id as string;
    });

    it("archives a client", async () => {
      const res = await request(testApp)
        .post(`/api/clients/${clientId}/archive`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("archived");
      expect(rb(res).data.archivedAt).toBeTruthy();
    });

    it("cannot update archived client", async () => {
      const res = await request(testApp)
        .patch(`/api/clients/${clientId}`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ fullName: "Updated Name" });

      expect(res.status).toBe(404);
    });

    it("restores a client", async () => {
      const res = await request(testApp)
        .post(`/api/clients/${clientId}/restore`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("active");
      expect(rb(res).data.archivedAt).toBeNull();
    });

    it("other tenant cannot see this client", async () => {
      const res = await request(testApp)
        .get(`/api/clients/${clientId}`)
        .set("Authorization", `Bearer ${tenantB.ownerToken}`)
        .set("x-company-id", tenantB.company.id);

      expect(res.status).toBe(404);
    });
  });

  describe("assets workflow", () => {
    let assetId: string;

    it("creates an asset", async () => {
      const res = await request(testApp)
        .post("/api/assets")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          branchId: tenantA.branch.id,
          assetType: "ebike",
          brand: "Trek",
          model: "Allant+",
          serialNumber: `SN-${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(rb(res).data.assetType).toBe("ebike");
      assetId = rb(res).data.id as string;
    });

    it("changes status draft → available", async () => {
      const res = await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ status: "available", reason: "Ready for fleet" });

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("available");
    });

    it("rejects invalid transition available → draft", async () => {
      const res = await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ status: "draft" });

      expect(res.status).toBe(422);
    });

    it("changes status available → maintenance", async () => {
      const res = await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ status: "maintenance", reason: "Scheduled check" });

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("maintenance");
    });

    it("records status history", async () => {
      const res = await request(testApp)
        .get(`/api/assets/${assetId}/status-history`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(
        (rb(res).data as unknown as Array<Record<string, unknown>>).length,
      ).toBeGreaterThanOrEqual(3);
    });

    it("archives and restores asset", async () => {
      const archiveRes = await request(testApp)
        .post(`/api/assets/${assetId}/archive`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(archiveRes.status).toBe(200);
      expect(rb(archiveRes).data.archivedAt).toBeTruthy();

      const restoreRes = await request(testApp)
        .post(`/api/assets/${assetId}/restore`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(restoreRes.status).toBe(200);
      expect(rb(restoreRes).data.archivedAt).toBeNull();
    });

    it("other tenant cannot change status of this asset", async () => {
      const res = await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantB.ownerToken}`)
        .set("x-company-id", tenantB.company.id)
        .send({ status: "available" });

      expect(res.status).toBe(404);
    });
  });

  describe("rental full workflow (create → approve → pickup → start → extend → return)", () => {
    let assetId: string;
    let clientId: string;
    let rentalId: string;

    async function forceRentalStatus(id: string, status: string) {
      await db
        .update(rentals)
        .set({ status: status as typeof rentals.$inferInsert.status })
        .where(eq(rentals.id, id));
    }

    beforeAll(async () => {
      const assetRes = await request(testApp)
        .post("/api/assets")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          branchId: tenantA.branch.id,
          assetType: "scooter",
          serialNumber: `RW-${Date.now()}`,
        });
      assetId = rb(assetRes).data.id as string;

      await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ status: "available" });

      const clientRes = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ fullName: "Rental Client" });
      clientId = rb(clientRes).data.id as string;
    });

    it("creates a rental", async () => {
      const res = await request(testApp)
        .post("/api/rentals")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ clientId, assetId, branchId: tenantA.branch.id });

      expect(res.status).toBe(201);
      expect(rb(res).data.status).toBe("draft");
      rentalId = rb(res).data.id as string;
    });

    it("approves the rental (draft → awaiting_payment)", async () => {
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/approve`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("awaiting_payment");
    });

    it("starts the rental (awaiting_pickup → active)", async () => {
      await forceRentalStatus(rentalId, "awaiting_pickup");

      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/start`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("active");
    });

    it("extends the rental (active → extended)", async () => {
      const nextWeek = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/extend`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ newEndDate: nextWeek, reason: "Customer requested extension" });

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("extended");
    });

    it("returns the rental (extended → completed)", async () => {
      const res = await request(testApp)
        .post(`/api/rentals/${rentalId}/return`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ assetReturnStatus: "available" });

      expect(res.status).toBe(200);
      expect(rb(res).data.status).toBe("completed");
      expect(rb(res).data.actualEndAt).toBeTruthy();
    });

    it("records rental status history", async () => {
      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}/status-history`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(
        (rb(res).data as unknown as Array<Record<string, unknown>>).length,
      ).toBeGreaterThanOrEqual(3);
    });

    it("other tenant cannot access this rental", async () => {
      const res = await request(testApp)
        .get(`/api/rentals/${rentalId}`)
        .set("Authorization", `Bearer ${tenantB.ownerToken}`)
        .set("x-company-id", tenantB.company.id);

      expect(res.status).toBe(404);
    });
  });

  describe("rental cancel workflow", () => {
    let assetId: string;
    let clientId: string;

    beforeAll(async () => {
      const assetRes = await request(testApp)
        .post("/api/assets")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          branchId: tenantA.branch.id,
          assetType: "bike",
          serialNumber: `CAN-${Date.now()}`,
        });
      assetId = rb(assetRes).data.id as string;

      await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ status: "available" });

      const clientRes = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ fullName: "Cancel Test Client" });
      clientId = rb(clientRes).data.id as string;
    });

    it("creates and cancels a draft rental", async () => {
      const createRes = await request(testApp)
        .post("/api/rentals")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ clientId, assetId, branchId: tenantA.branch.id });

      expect(createRes.status).toBe(201);

      const cancelRes = await request(testApp)
        .post(`/api/rentals/${rb(createRes).data.id}/cancel`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ reason: "Customer changed mind" });

      expect(cancelRes.status).toBe(200);
      expect(rb(cancelRes).data.status).toBe("canceled");
    });
  });

  describe("blacklist strongest decision", () => {
    let clientId: string;

    beforeAll(async () => {
      const clientRes = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ fullName: "Blacklist Test Client" });
      clientId = rb(clientRes).data.id as string;
    });

    it("creates a warning-level blacklist entry", async () => {
      const res = await request(testApp)
        .post("/api/blacklist")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          clientId,
          scopeType: "company",
          actionType: "warning",
          reasonCode: "late_return",
        });

      expect(res.status).toBe(201);
    });

    it("check returns warning (not blocked)", async () => {
      const res = await request(testApp)
        .post("/api/blacklist/check")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ clientId });

      expect(res.status).toBe(200);
      expect(rb(res).data.isBlacklisted).toBe(true);
      expect(rb(res).data.isBlocked).toBe(false);
      expect(rb(res).data.strongestAction).toBe("warning");
    });

    it("adds a blocking-level entry", async () => {
      const res = await request(testApp)
        .post("/api/blacklist")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          clientId,
          scopeType: "company",
          actionType: "blocked_company",
          reasonCode: "fraud",
        });

      expect(res.status).toBe(201);
    });

    it("check returns strongest decision (blocked_company)", async () => {
      const res = await request(testApp)
        .post("/api/blacklist/check")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ clientId });

      expect(res.status).toBe(200);
      expect(rb(res).data.isBlocked).toBe(true);
      expect(rb(res).data.strongestAction).toBe("blocked_company");
      expect(rb(res).data.strongestSeverity).toBe(6);
    });

    it("blocked client cannot create rental", async () => {
      const assetRes = await request(testApp)
        .post("/api/assets")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          branchId: tenantA.branch.id,
          assetType: "scooter",
          serialNumber: `BL-${Date.now()}`,
        });
      const assetId = rb(assetRes).data.id as string;

      await request(testApp)
        .post(`/api/assets/${assetId}/status`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ status: "available" });

      const rentalRes = await request(testApp)
        .post("/api/rentals")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ clientId, assetId, branchId: tenantA.branch.id });

      expect(rentalRes.status).toBe(422);
    });
  });

  describe("blacklist revoke", () => {
    let clientId: string;

    beforeAll(async () => {
      const clientRes = await request(testApp)
        .post("/api/clients")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ fullName: "Revoke Test Client" });
      clientId = rb(clientRes).data.id as string;
    });

    it("creates and revokes a blacklist entry", async () => {
      const createRes = await request(testApp)
        .post("/api/blacklist")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          clientId,
          scopeType: "company",
          actionType: "blocked_company",
          reasonCode: "test",
        });

      const revokeRes = await request(testApp)
        .post(`/api/blacklist/${rb(createRes).data.id}/revoke`)
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(revokeRes.status).toBe(200);
      expect(rb(revokeRes).data.endsAt).toBeTruthy();
    });

    it("revoked entry no longer blocks", async () => {
      const checkRes = await request(testApp)
        .post("/api/blacklist/check")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({ clientId });

      expect(checkRes.status).toBe(200);
      expect(rb(checkRes).data.isBlocked).toBe(false);
    });

    it("other tenant cannot revoke this entry", async () => {
      const newEntry = await request(testApp)
        .post("/api/blacklist")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id)
        .send({
          clientId,
          scopeType: "company",
          actionType: "warning",
          reasonCode: "test2",
        });

      const res = await request(testApp)
        .post(`/api/blacklist/${rb(newEntry).data.id}/revoke`)
        .set("Authorization", `Bearer ${tenantB.ownerToken}`)
        .set("x-company-id", tenantB.company.id);

      expect(res.status).toBe(404);
    });
  });

  describe("tenant-scoped audit logs", () => {
    it("can query tenant audit logs", async () => {
      const res = await request(testApp)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(rb(res).data.items).toBeDefined();
      expect(rb(res).data.pagination).toBeDefined();
      expect((rb(res).data.pagination as Record<string, unknown>).page).toBe(1);
      expect(
        (rb(res).data.items as unknown as Array<Record<string, unknown>>)
          .length,
      ).toBeGreaterThan(0);
    });

    it("can filter audit logs by entityType", async () => {
      const res = await request(testApp)
        .get("/api/audit-logs?entityType=rental")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      for (const item of rb(res).data.items as unknown as Array<
        Record<string, unknown>
      >) {
        expect(item.entityType).toBe("rental");
      }
    });

    it("can filter audit logs by action", async () => {
      const res = await request(testApp)
        .get("/api/audit-logs?action=create")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      for (const item of rb(res).data.items as unknown as Array<
        Record<string, unknown>
      >) {
        expect(item.action).toBe("create");
      }
    });

    it("audit logs have before/after for workflow actions", async () => {
      const res = await request(testApp)
        .get("/api/audit-logs?entityType=rental&action=approve")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      expect(res.status).toBe(200);
      expect(
        (rb(res).data.items as unknown as Array<Record<string, unknown>>)
          .length,
      ).toBeGreaterThanOrEqual(1);
      const item = (
        rb(res).data.items as unknown as Array<Record<string, unknown>>
      )[0];
      expect(item.before).toBeDefined();
      expect(item.after).toBeDefined();
      expect((item.before as Record<string, unknown>).status).toBeDefined();
      expect((item.after as Record<string, unknown>).status).toBeDefined();
    });

    it("other tenant cannot see these logs", async () => {
      const resA = await request(testApp)
        .get("/api/audit-logs?entityType=rental")
        .set("Authorization", `Bearer ${tenantA.ownerToken}`)
        .set("x-company-id", tenantA.company.id);

      const resB = await request(testApp)
        .get("/api/audit-logs?entityType=rental")
        .set("Authorization", `Bearer ${tenantB.ownerToken}`)
        .set("x-company-id", tenantB.company.id);

      expect(
        (rb(resA).data.items as unknown as Array<Record<string, unknown>>)
          .length,
      ).toBeGreaterThan(0);

      for (const item of rb(resB).data.items as unknown as Array<
        Record<string, unknown>
      >) {
        for (const itemA of rb(resA).data.items as unknown as Array<
          Record<string, unknown>
        >) {
          expect(item.id).not.toBe(itemA.id);
        }
      }
    });
  });
});
