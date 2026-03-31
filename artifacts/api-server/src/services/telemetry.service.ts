import { db, telemetrySnapshots, telemetryEvents, locationHistory, assetDevices, devices } from "@workspace/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { createHash } from "crypto";
import * as deviceService from "./device.service";

function payloadSignature(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? "")).digest("hex").slice(0, 32);
}

interface IngestInput {
  provider: string;
  deviceExternalId?: string;
  deviceId?: string;
  recordedAt: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  batteryPercent?: number;
  batteryVoltage?: number;
  lockState?: string;
  alarmState?: string;
  onlineState?: string;
  odometer?: number;
  rawPayload?: unknown;
  events?: Array<{ eventType: string; severity?: string; payload?: unknown }>;
}

interface IngestContext {
  companyId: string;
  provider: string;
}

export async function ingestTelemetry(input: IngestInput, ctx: IngestContext) {
  let device: typeof devices.$inferSelect | null = null;

  if (input.deviceId) {
    device = await deviceService.getDevice(input.deviceId, ctx.companyId).catch(() => null);
  }
  if (!device && input.deviceExternalId) {
    device = await deviceService.getDeviceByExternalId(ctx.companyId, ctx.provider, input.deviceExternalId);
  }
  if (!device) {
    return { status: "skipped", reason: "device_not_found" };
  }

  if (device.companyId !== ctx.companyId) {
    return { status: "skipped", reason: "company_mismatch" };
  }

  if (device.provider !== ctx.provider) {
    return { status: "skipped", reason: "provider_mismatch" };
  }

  const recordedAt = new Date(input.recordedAt);
  const sig = payloadSignature({ ...input, deviceId: device.id });

  const activeBindings = await db.select({ assetId: assetDevices.assetId }).from(assetDevices)
    .where(and(eq(assetDevices.deviceId, device.id), eq(assetDevices.companyId, ctx.companyId), eq(assetDevices.status, "active")))
    .limit(1);
  const assetId = activeBindings.length > 0 ? activeBindings[0].assetId : null;

  const [snapshot] = await db.insert(telemetrySnapshots).values({
    companyId: ctx.companyId,
    assetId,
    deviceId: device.id,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    speed: input.speed ?? null,
    heading: input.heading ?? null,
    batteryPercent: input.batteryPercent ?? null,
    batteryVoltage: input.batteryVoltage ?? null,
    lockState: input.lockState ?? null,
    alarmState: input.alarmState ?? null,
    onlineState: input.onlineState ?? null,
    odometer: input.odometer ?? null,
    payload: input.rawPayload ?? null,
    recordedAt,
  }).returning();

  if (input.lat != null && input.lng != null) {
    await db.insert(locationHistory).values({
      companyId: ctx.companyId,
      assetId,
      deviceId: device.id,
      lat: input.lat,
      lng: input.lng,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      recordedAt,
    });
  }

  if (input.events && input.events.length > 0) {
    for (const evt of input.events) {
      await db.insert(telemetryEvents).values({
        companyId: ctx.companyId,
        assetId,
        deviceId: device.id,
        eventType: evt.eventType as any,
        severity: (evt.severity ?? "info") as any,
        payload: evt.payload ?? null,
        recordedAt,
      });
    }
  }

  if (input.onlineState === "online" || input.lat != null) {
    const derivedEvents: Array<{ eventType: string; severity: string }> = [];
    if (input.onlineState === "online") derivedEvents.push({ eventType: "online", severity: "info" });
    if (input.batteryPercent != null && input.batteryPercent < 15) derivedEvents.push({ eventType: "low_battery", severity: "warning" });
    for (const de of derivedEvents) {
      await db.insert(telemetryEvents).values({
        companyId: ctx.companyId,
        assetId,
        deviceId: device.id,
        eventType: de.eventType as any,
        severity: de.severity as any,
        recordedAt,
      });
    }
  }

  await deviceService.updateLastSeen(device.id);

  return { status: "ok", snapshotId: snapshot.id, deviceId: device.id, assetId };
}

export async function getLatestSnapshotForAsset(assetId: string, companyId: string) {
  const [snap] = await db.select().from(telemetrySnapshots)
    .where(and(eq(telemetrySnapshots.assetId, assetId), eq(telemetrySnapshots.companyId, companyId)))
    .orderBy(desc(telemetrySnapshots.recordedAt)).limit(1);
  return snap ?? null;
}

export async function getLatestSnapshotForDevice(deviceId: string, companyId: string) {
  const [snap] = await db.select().from(telemetrySnapshots)
    .where(and(eq(telemetrySnapshots.deviceId, deviceId), eq(telemetrySnapshots.companyId, companyId)))
    .orderBy(desc(telemetrySnapshots.recordedAt)).limit(1);
  return snap ?? null;
}

export async function getEventsForAsset(assetId: string, companyId: string, filters?: { from?: string; to?: string; eventType?: string; severity?: string; limit?: number; offset?: number }) {
  const conditions = [eq(telemetryEvents.assetId, assetId), eq(telemetryEvents.companyId, companyId)];
  if (filters?.from) conditions.push(gte(telemetryEvents.recordedAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(telemetryEvents.recordedAt, new Date(filters.to)));
  if (filters?.eventType) conditions.push(eq(telemetryEvents.eventType, filters.eventType as any));
  if (filters?.severity) conditions.push(eq(telemetryEvents.severity, filters.severity as any));
  return db.select().from(telemetryEvents).where(and(...conditions))
    .orderBy(desc(telemetryEvents.recordedAt)).limit(filters?.limit ?? 100).offset(filters?.offset ?? 0);
}

export async function getEventsForDevice(deviceId: string, companyId: string, filters?: { from?: string; to?: string; eventType?: string; severity?: string; limit?: number; offset?: number }) {
  const conditions = [eq(telemetryEvents.deviceId, deviceId), eq(telemetryEvents.companyId, companyId)];
  if (filters?.from) conditions.push(gte(telemetryEvents.recordedAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(telemetryEvents.recordedAt, new Date(filters.to)));
  if (filters?.eventType) conditions.push(eq(telemetryEvents.eventType, filters.eventType as any));
  if (filters?.severity) conditions.push(eq(telemetryEvents.severity, filters.severity as any));
  return db.select().from(telemetryEvents).where(and(...conditions))
    .orderBy(desc(telemetryEvents.recordedAt)).limit(filters?.limit ?? 100).offset(filters?.offset ?? 0);
}

export async function getLocationsForAsset(assetId: string, companyId: string, filters?: { from?: string; to?: string; limit?: number; offset?: number }) {
  const conditions = [eq(locationHistory.assetId, assetId), eq(locationHistory.companyId, companyId)];
  if (filters?.from) conditions.push(gte(locationHistory.recordedAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(locationHistory.recordedAt, new Date(filters.to)));
  return db.select().from(locationHistory).where(and(...conditions))
    .orderBy(desc(locationHistory.recordedAt)).limit(filters?.limit ?? 200).offset(filters?.offset ?? 0);
}
