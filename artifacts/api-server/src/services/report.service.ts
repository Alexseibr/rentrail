import {
  db,
  assets,
  telemetrySnapshots,
  devices,
} from "@workspace/db";
import { eq, and, desc, lt, isNull, lte } from "drizzle-orm";

export async function getLiveMapData(
  companyId: string,
  filters?: { branchId?: string; assetType?: string; status?: string },
) {
  const allAssets = await db
    .select({
      id: assets.id,
      assetType: assets.assetType,
      status: assets.status,
      brand: assets.brand,
      model: assets.model,
      branchId: assets.branchId,
      stationId: assets.stationId,
    })
    .from(assets)
    .where(and(eq(assets.companyId, companyId), isNull(assets.archivedAt)));

  let filtered = allAssets;
  if (filters?.branchId)
    filtered = filtered.filter((a) => a.branchId === filters.branchId);
  if (filters?.assetType)
    filtered = filtered.filter((a) => a.assetType === filters.assetType);
  if (filters?.status)
    filtered = filtered.filter((a) => a.status === filters.status);

  const results = [];
  for (const asset of filtered) {
    const [snap] = await db
      .select({
        lat: telemetrySnapshots.lat,
        lng: telemetrySnapshots.lng,
        batteryPercent: telemetrySnapshots.batteryPercent,
        lockState: telemetrySnapshots.lockState,
        onlineState: telemetrySnapshots.onlineState,
        recordedAt: telemetrySnapshots.recordedAt,
      })
      .from(telemetrySnapshots)
      .where(
        and(
          eq(telemetrySnapshots.assetId, asset.id),
          eq(telemetrySnapshots.companyId, companyId),
        ),
      )
      .orderBy(desc(telemetrySnapshots.recordedAt))
      .limit(1);

    results.push({
      assetId: asset.id,
      assetType: asset.assetType,
      status: asset.status,
      brand: asset.brand,
      model: asset.model,
      branchId: asset.branchId,
      stationId: asset.stationId,
      lat: snap?.lat ?? null,
      lng: snap?.lng ?? null,
      batteryPercent: snap?.batteryPercent ?? null,
      lockState: snap?.lockState ?? null,
      onlineState: snap?.onlineState ?? null,
      lastSeenAt: snap?.recordedAt ?? null,
    });
  }

  return results.filter((r) => r.lat != null || r.lng != null);
}

export async function getLowBatteryAssets(companyId: string, threshold = 20) {
  const snaps = await db
    .select({
      assetId: telemetrySnapshots.assetId,
      deviceId: telemetrySnapshots.deviceId,
      batteryPercent: telemetrySnapshots.batteryPercent,
      recordedAt: telemetrySnapshots.recordedAt,
    })
    .from(telemetrySnapshots)
    .where(
      and(
        eq(telemetrySnapshots.companyId, companyId),
        lte(telemetrySnapshots.batteryPercent, threshold),
      ),
    )
    .orderBy(desc(telemetrySnapshots.recordedAt))
    .limit(100);

  const seen = new Set<string>();
  return snaps.filter((s) => {
    const key = s.assetId ?? s.deviceId ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getOfflineDevices(
  companyId: string,
  thresholdMinutes = 30,
) {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60000);
  return db
    .select({
      id: devices.id,
      deviceType: devices.deviceType,
      provider: devices.provider,
      externalId: devices.externalId,
      status: devices.status,
      lastSeenAt: devices.lastSeenAt,
      branchId: devices.branchId,
    })
    .from(devices)
    .where(
      and(
        eq(devices.companyId, companyId),
        eq(devices.status, "active"),
        lt(devices.lastSeenAt, cutoff),
      ),
    );
}
