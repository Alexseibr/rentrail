import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";

import { db, rentalPlans } from "@workspace/db";
import { clients } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import {
  createTestAsset,
  createTestClient,
  createTestTenant,
  testApp,
} from "../helpers";

describe("client price preview API", () => {
  let companyId = "";
  let assetId = "";
  let clientToken = "";
  let hourlyPlanId = "";
  let dailyPlanId = "";
  let unavailableAssetId = "";

  beforeAll(async () => {
    const tenant = await createTestTenant();
    companyId = tenant.company.id;

    const asset = await createTestAsset(companyId, tenant.branch.id, {
      status: "available",
      assetType: "ebike",
    });
    assetId = asset.id;
    const unavailableAsset = await createTestAsset(
      companyId,
      tenant.branch.id,
      {
        status: "maintenance",
        assetType: "ebike",
      },
    );
    unavailableAssetId = unavailableAsset.id;

    const [plan] = await db
      .insert(rentalPlans)
      .values({
        companyId,
        name: "Hourly Test",
        rentalType: "hourly",
        price: "300",
        currency: "RUB",
        depositAmount: "1000",
        isActive: true,
      })
      .returning({ id: rentalPlans.id });
    hourlyPlanId = plan.id;
    const [dailyPlan] = await db
      .insert(rentalPlans)
      .values({
        companyId,
        name: "Daily Test",
        rentalType: "daily",
        price: "900",
        currency: "RUB",
        depositAmount: "2000",
        isActive: true,
      })
      .returning({ id: rentalPlans.id });
    dailyPlanId = dailyPlan.id;

    const client = await createTestClient(companyId, {
      phone: "+15555550001",
      fullName: "Client Preview",
      email: "client-preview@test.com",
    });
    const passwordHash = await bcrypt.hash("secret123", 10);
    await db
      .update(clients)
      .set({ passwordHash, status: "active" })
      .where(and(eq(clients.id, client.id), eq(clients.companyId, companyId)));

    const loginRes = await request(testApp)
      .post("/api/auth/client/login")
      .send({
        phone: client.phone,
        password: "secret123",
        companyId,
      });

    expect(loginRes.status).toBe(200);
    clientToken = loginRes.body.data.accessToken as string;
  });

  it("returns preview payload for available public vehicle", async () => {
    const res = await request(testApp)
      .get(`/api/client/vehicles/${assetId}/price-preview`)
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe("RUB");
    expect(res.body.data.rentalPlanId).toBe(hourlyPlanId);
    expect(res.body.data.totalDueNow).toBe(1300);
  });

  it("uses requested rentalPlanId when provided", async () => {
    const res = await request(testApp)
      .get(`/api/client/vehicles/${assetId}/price-preview`)
      .query({ rentalPlanId: dailyPlanId })
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rentalPlanId).toBe(dailyPlanId);
    expect(res.body.data.rentalPlanName).toBe("Daily Test");
    expect(res.body.data.totalDueNow).toBe(2900);
  });

  it("returns 400 for unavailable rentalPlanId", async () => {
    const res = await request(testApp)
      .get(`/api/client/vehicles/${assetId}/price-preview`)
      .query({ rentalPlanId: "11111111-1111-1111-1111-111111111111" })
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for not-available vehicle", async () => {
    const res = await request(testApp)
      .get(`/api/client/vehicles/${unavailableAssetId}/price-preview`)
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown vehicle id", async () => {
    const res = await request(testApp)
      .get(
        "/api/client/vehicles/11111111-1111-1111-1111-111111111111/price-preview",
      )
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 401 without auth token", async () => {
    const res = await request(testApp).get(
      `/api/client/vehicles/${assetId}/price-preview`,
    );

    expect(res.status).toBe(401);
  });

  it("supports CRUD-like flow for client payment methods", async () => {
    const createRes = await request(testApp)
      .post("/api/client/payment-methods")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        provider: "yukassa",
        token: "pm_test_123",
        title: "Visa •• 1234",
      });
    expect(createRes.status).toBe(201);
    const methodId = createRes.body.data.id as string;
    expect(createRes.body.data.isDefault).toBe(true);

    const listRes = await request(testApp)
      .get("/api/client/payment-methods")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(listRes.status).toBe(200);
    expect(
      (listRes.body.data as Array<{ id: string }>).some(
        (m) => m.id === methodId,
      ),
    ).toBe(true);

    const defaultRes = await request(testApp)
      .post(`/api/client/payment-methods/${methodId}/default`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.data.isDefault).toBe(true);

    const secondCreateRes = await request(testApp)
      .post("/api/client/payment-methods")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        provider: "tinkoff",
        token: "pm_test_456",
        title: "Mastercard •• 5678",
      });
    expect(secondCreateRes.status).toBe(201);
    const secondMethodId = secondCreateRes.body.data.id as string;
    expect(secondCreateRes.body.data.isDefault).toBe(false);

    const deleteRes = await request(testApp)
      .delete(`/api/client/payment-methods/${methodId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.archived).toBe(true);

    const listAfterDelete = await request(testApp)
      .get("/api/client/payment-methods")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(listAfterDelete.status).toBe(200);
    const fallbackDefault = (
      listAfterDelete.body.data as Array<{
        id: string;
        isDefault: boolean;
      }>
    ).find((m) => m.id === secondMethodId);
    expect(fallbackDefault?.isDefault).toBe(true);
  });

  it("rejects payment method with unsupported provider", async () => {
    const res = await request(testApp)
      .post("/api/client/payment-methods")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        provider: "stripe",
        token: "pm_bad_provider",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("rejects payment method with invalid card metadata", async () => {
    const res = await request(testApp)
      .post("/api/client/payment-methods")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        provider: "yukassa",
        token: "pm_bad_metadata",
        metadata: { maskedPan: "4111-****-1111" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});
