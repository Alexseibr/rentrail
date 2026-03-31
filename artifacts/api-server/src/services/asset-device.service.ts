import { db, assetDevices, assets, devices } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

export async function bindDeviceToAsset(companyId: string, assetId: string, data: {
  deviceId: string;
  bindingType: string;
  isPrimary?: boolean;
  notes?: string;
}) {
  const [asset] = await db.select({ id: assets.id, companyId: assets.companyId }).from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId))).limit(1);
  if (!asset) throw new NotFoundError("Asset not found");

  const [device] = await db.select({ id: devices.id, companyId: devices.companyId }).from(devices)
    .where(and(eq(devices.id, data.deviceId), eq(devices.companyId, companyId))).limit(1);
  if (!device) throw new NotFoundError("Device not found or belongs to a different company");

  const existingActive = await db.select().from(assetDevices)
    .where(and(eq(assetDevices.assetId, assetId), eq(assetDevices.deviceId, data.deviceId), eq(assetDevices.status, "active"))).limit(1);
  if (existingActive.length > 0) throw new AppError(409, "Device is already bound to this asset", "ALREADY_BOUND");

  if (data.isPrimary) {
    await db.update(assetDevices).set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(assetDevices.assetId, assetId), eq(assetDevices.bindingType, data.bindingType as any), eq(assetDevices.status, "active")));
  }

  const [binding] = await db.insert(assetDevices).values({
    companyId,
    assetId,
    deviceId: data.deviceId,
    bindingType: data.bindingType as any,
    isPrimary: data.isPrimary ?? false,
    notes: data.notes ?? null,
  }).returning();
  return binding;
}

export async function getAssetBindings(assetId: string, companyId: string) {
  return db.select().from(assetDevices)
    .where(and(eq(assetDevices.assetId, assetId), eq(assetDevices.companyId, companyId), eq(assetDevices.status, "active")));
}

export async function removeBinding(assetId: string, bindingId: string, companyId: string) {
  const [binding] = await db.select().from(assetDevices)
    .where(and(eq(assetDevices.id, bindingId), eq(assetDevices.assetId, assetId), eq(assetDevices.companyId, companyId))).limit(1);
  if (!binding) throw new NotFoundError("Binding not found");
  if (binding.status === "removed") throw new AppError(409, "Binding already removed", "ALREADY_REMOVED");

  const [updated] = await db.update(assetDevices).set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
    .where(eq(assetDevices.id, bindingId)).returning();
  return updated;
}

export async function setPrimaryBinding(assetId: string, bindingId: string, companyId: string) {
  const [binding] = await db.select().from(assetDevices)
    .where(and(eq(assetDevices.id, bindingId), eq(assetDevices.assetId, assetId), eq(assetDevices.companyId, companyId), eq(assetDevices.status, "active"))).limit(1);
  if (!binding) throw new NotFoundError("Active binding not found");

  await db.update(assetDevices).set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(assetDevices.assetId, assetId), eq(assetDevices.bindingType, binding.bindingType), eq(assetDevices.status, "active")));

  const [updated] = await db.update(assetDevices).set({ isPrimary: true, updatedAt: new Date() })
    .where(eq(assetDevices.id, bindingId)).returning();
  return updated;
}

export async function getCurrentActiveDevicesForAsset(assetId: string, companyId: string) {
  const bindings = await db.select({
    bindingId: assetDevices.id,
    bindingType: assetDevices.bindingType,
    isPrimary: assetDevices.isPrimary,
    deviceId: devices.id,
    deviceType: devices.deviceType,
    provider: devices.provider,
    externalId: devices.externalId,
    deviceStatus: devices.status,
    lastSeenAt: devices.lastSeenAt,
  })
    .from(assetDevices)
    .innerJoin(devices, eq(assetDevices.deviceId, devices.id))
    .where(and(eq(assetDevices.assetId, assetId), eq(assetDevices.companyId, companyId), eq(assetDevices.status, "active")));
  return bindings;
}
