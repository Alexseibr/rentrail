import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

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
});
