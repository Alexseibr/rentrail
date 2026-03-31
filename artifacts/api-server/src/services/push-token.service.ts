import { db, pushDeviceTokens } from "@workspace/db";
import { eq, and } from "drizzle-orm";

interface RegisterTokenParams {
  userId: string;
  companyId?: string;
  token: string;
  platform: string;
  appVersion?: string;
  deviceId?: string;
}

export async function registerToken(params: RegisterTokenParams) {
  const existing = await db.select().from(pushDeviceTokens).where(
    eq(pushDeviceTokens.token, params.token),
  );

  if (existing.length > 0) {
    const [updated] = await db.update(pushDeviceTokens)
      .set({
        userId: params.userId,
        companyId: params.companyId ?? null,
        platform: params.platform,
        appVersion: params.appVersion ?? null,
        deviceId: params.deviceId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(pushDeviceTokens.token, params.token))
      .returning();
    return updated;
  }

  const [token] = await db.insert(pushDeviceTokens).values({
    userId: params.userId,
    companyId: params.companyId ?? null,
    token: params.token,
    platform: params.platform,
    appVersion: params.appVersion ?? null,
    deviceId: params.deviceId ?? null,
  }).returning();
  return token;
}

export async function unregisterToken(token: string, userId: string) {
  const [deleted] = await db.delete(pushDeviceTokens).where(
    and(eq(pushDeviceTokens.token, token), eq(pushDeviceTokens.userId, userId)),
  ).returning();
  return deleted;
}

export async function unregisterAllUserTokens(userId: string) {
  await db.delete(pushDeviceTokens).where(eq(pushDeviceTokens.userId, userId));
}

export async function getUserTokens(userId: string) {
  return db.select().from(pushDeviceTokens).where(eq(pushDeviceTokens.userId, userId));
}

export async function getCompanyTokens(companyId: string) {
  return db.select().from(pushDeviceTokens).where(eq(pushDeviceTokens.companyId, companyId));
}
