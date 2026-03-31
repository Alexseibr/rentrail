import { db, devices, assetDevices } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import { validateBranchOwnership, validateStationOwnership } from "../lib/validate-ownership";

type DeviceStatus = typeof devices.$inferSelect.status;

const DEVICE_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "maintenance", "retired"],
  active: ["inactive", "offline", "maintenance", "blocked", "retired"],
  inactive: ["active", "maintenance", "retired"],
  offline: ["active", "inactive", "maintenance", "blocked"],
  maintenance: ["active", "inactive", "retired"],
  blocked: ["active", "maintenance", "retired"],
  retired: [],
};

export async function createDevice(companyId: string, data: {
  branchId?: string;
  stationId?: string;
  deviceType: string;
  provider: string;
  externalId: string;
  serialNumber?: string;
  imei?: string;
  simNumber?: string;
  firmwareVersion?: string;
  capabilities?: unknown;
  metadata?: unknown;
}) {
  await validateBranchOwnership(companyId, data.branchId);
  await validateStationOwnership(companyId, data.stationId);

  const [device] = await db.insert(devices).values({
    companyId,
    branchId: data.branchId ?? null,
    stationId: data.stationId ?? null,
    deviceType: data.deviceType as DeviceStatus,
    provider: data.provider,
    externalId: data.externalId,
    serialNumber: data.serialNumber ?? null,
    imei: data.imei ?? null,
    simNumber: data.simNumber ?? null,
    firmwareVersion: data.firmwareVersion ?? null,
    capabilities: data.capabilities ?? null,
    metadata: data.metadata ?? null,
  } as typeof devices.$inferInsert).returning();
  return device;
}

export async function getDevice(id: string, companyId: string) {
  const [device] = await db.select().from(devices)
    .where(and(eq(devices.id, id), eq(devices.companyId, companyId))).limit(1);
  if (!device) throw new NotFoundError("Device not found");
  return device;
}

export async function listDevices(companyId: string, filters?: { status?: string; deviceType?: string; branchId?: string; provider?: string }) {
  const conditions = [eq(devices.companyId, companyId), isNull(devices.archivedAt)];
  if (filters?.status) conditions.push(eq(devices.status, filters.status as DeviceStatus));
  if (filters?.deviceType) conditions.push(eq(devices.deviceType, filters.deviceType as any));
  if (filters?.branchId) conditions.push(eq(devices.branchId, filters.branchId));
  if (filters?.provider) conditions.push(eq(devices.provider, filters.provider));
  return db.select().from(devices).where(and(...conditions));
}

export async function updateDevice(id: string, companyId: string, data: Record<string, unknown>) {
  delete data.companyId; delete data.id; delete data.status;
  await validateBranchOwnership(companyId, data.branchId as string | undefined);
  await validateStationOwnership(companyId, data.stationId as string | undefined);
  const [updated] = await db.update(devices).set({ ...data, updatedAt: new Date() } as any)
    .where(and(eq(devices.id, id), eq(devices.companyId, companyId))).returning();
  if (!updated) throw new NotFoundError("Device not found");
  return updated;
}

export async function changeDeviceStatus(id: string, companyId: string, newStatus: string) {
  const device = await getDevice(id, companyId);
  const allowed = DEVICE_STATUS_TRANSITIONS[device.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(422, `Cannot transition device from '${device.status}' to '${newStatus}'`, "INVALID_STATUS_TRANSITION");
  }
  const [updated] = await db.update(devices).set({ status: newStatus as DeviceStatus, updatedAt: new Date() })
    .where(and(eq(devices.id, id), eq(devices.companyId, companyId))).returning();
  return updated;
}

export async function archiveDevice(id: string, companyId: string) {
  const device = await getDevice(id, companyId);
  if (device.archivedAt) throw new AppError(409, "Device already archived", "ALREADY_ARCHIVED");
  const [updated] = await db.update(devices).set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(devices.id, id), eq(devices.companyId, companyId))).returning();
  return updated;
}

export async function restoreDevice(id: string, companyId: string) {
  const device = await getDevice(id, companyId);
  if (!device.archivedAt) throw new AppError(409, "Device is not archived", "NOT_ARCHIVED");
  const [updated] = await db.update(devices).set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(devices.id, id), eq(devices.companyId, companyId))).returning();
  return updated;
}

export async function getDeviceByExternalId(companyId: string, provider: string, externalId: string) {
  const [device] = await db.select().from(devices)
    .where(and(eq(devices.companyId, companyId), eq(devices.provider, provider), eq(devices.externalId, externalId))).limit(1);
  return device ?? null;
}

export async function updateLastSeen(id: string) {
  await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, id));
}

export async function getActiveBindingsForDevice(deviceId: string, companyId: string) {
  return db.select().from(assetDevices)
    .where(and(eq(assetDevices.deviceId, deviceId), eq(assetDevices.companyId, companyId), eq(assetDevices.status, "active")));
}
