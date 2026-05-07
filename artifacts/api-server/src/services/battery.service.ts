import {
  db,
  batteries,
  batteryAssignments,
  batteryEvents,
  assets,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import {
  validateBranchOwnership,
  validateStationOwnership,
} from "../lib/validate-ownership";

type BatteryStatus = typeof batteries.$inferSelect.status;

export async function createBattery(
  companyId: string,
  data: {
    branchId?: string;
    stationId?: string;
    serialNumber: string;
    model?: string;
    capacityWh?: number;
    healthPercent?: number;
    cycleCount?: number;
    currentChargePercent?: number;
    currentVoltage?: number;
    metadata?: unknown;
  },
) {
  await validateBranchOwnership(companyId, data.branchId);
  await validateStationOwnership(companyId, data.stationId);

  const [battery] = await db
    .insert(batteries)
    .values({
      companyId,
      ...data,
      branchId: data.branchId ?? null,
      stationId: data.stationId ?? null,
    } as typeof batteries.$inferInsert)
    .returning();
  return battery;
}

export async function getBattery(id: string, companyId: string) {
  const [bat] = await db
    .select()
    .from(batteries)
    .where(and(eq(batteries.id, id), eq(batteries.companyId, companyId)))
    .limit(1);
  if (!bat) throw new NotFoundError("Battery not found");
  return bat;
}

export async function listBatteries(
  companyId: string,
  filters?: { status?: string; branchId?: string },
) {
  const conditions = [
    eq(batteries.companyId, companyId),
    isNull(batteries.archivedAt),
  ];
  if (filters?.status)
    conditions.push(eq(batteries.status, filters.status as BatteryStatus));
  if (filters?.branchId)
    conditions.push(eq(batteries.branchId, filters.branchId));
  return db
    .select()
    .from(batteries)
    .where(and(...conditions));
}

export async function updateBattery(
  id: string,
  companyId: string,
  data: Record<string, unknown>,
) {
  delete data.companyId;
  delete data.id;
  delete data.status;
  await validateBranchOwnership(companyId, data.branchId as string | undefined);
  await validateStationOwnership(
    companyId,
    data.stationId as string | undefined,
  );
  const [updated] = await db
    .update(batteries)
    .set({ ...data, updatedAt: new Date() } as Partial<
      typeof batteries.$inferInsert
    > & { updatedAt: Date })
    .where(and(eq(batteries.id, id), eq(batteries.companyId, companyId)))
    .returning();
  if (!updated) throw new NotFoundError("Battery not found");
  return updated;
}

export async function archiveBattery(id: string, companyId: string) {
  const bat = await getBattery(id, companyId);
  if (bat.archivedAt)
    throw new AppError(409, "Battery already archived", "ALREADY_ARCHIVED");
  const [updated] = await db
    .update(batteries)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(batteries.id, id), eq(batteries.companyId, companyId)))
    .returning();
  return updated;
}

export async function assignBattery(
  companyId: string,
  assetId: string,
  data: { batteryId: string; userId?: string; notes?: string },
) {
  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)))
    .limit(1);
  if (!asset) throw new NotFoundError("Asset not found");

  const battery = await getBattery(data.batteryId, companyId);

  const activeOnBattery = await db
    .select()
    .from(batteryAssignments)
    .where(
      and(
        eq(batteryAssignments.batteryId, data.batteryId),
        eq(batteryAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (activeOnBattery.length > 0)
    throw new AppError(
      409,
      "Battery already assigned to another asset",
      "BATTERY_IN_USE",
    );

  const activeOnAsset = await db
    .select()
    .from(batteryAssignments)
    .where(
      and(
        eq(batteryAssignments.assetId, assetId),
        eq(batteryAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (activeOnAsset.length > 0)
    throw new AppError(
      409,
      "Asset already has an active battery",
      "ASSET_HAS_BATTERY",
    );

  const [assignment] = await db
    .insert(batteryAssignments)
    .values({
      companyId,
      batteryId: data.batteryId,
      assetId,
      installedByUserId: data.userId ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  await db
    .update(batteries)
    .set({ status: "installed", updatedAt: new Date() })
    .where(eq(batteries.id, data.batteryId));

  await db.insert(batteryEvents).values({
    companyId,
    batteryId: data.batteryId,
    assetId,
    eventType: "installed",
    recordedAt: new Date(),
  });

  return assignment;
}

export async function removeBattery(
  companyId: string,
  assetId: string,
  data: { userId?: string; notes?: string },
) {
  const [active] = await db
    .select()
    .from(batteryAssignments)
    .where(
      and(
        eq(batteryAssignments.assetId, assetId),
        eq(batteryAssignments.companyId, companyId),
        eq(batteryAssignments.status, "active"),
      ),
    )
    .limit(1);
  if (!active)
    throw new NotFoundError("No active battery assignment for this asset");

  const [updated] = await db
    .update(batteryAssignments)
    .set({
      status: "removed",
      removedAt: new Date(),
      removedByUserId: data.userId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(batteryAssignments.id, active.id))
    .returning();

  await db
    .update(batteries)
    .set({ status: "available", updatedAt: new Date() })
    .where(eq(batteries.id, active.batteryId));

  await db.insert(batteryEvents).values({
    companyId,
    batteryId: active.batteryId,
    assetId,
    eventType: "removed",
    recordedAt: new Date(),
  });

  return updated;
}

export async function getAssetBatteries(assetId: string, companyId: string) {
  return db
    .select()
    .from(batteryAssignments)
    .where(
      and(
        eq(batteryAssignments.assetId, assetId),
        eq(batteryAssignments.companyId, companyId),
      ),
    );
}

export async function getBatteryEvents(batteryId: string, companyId: string) {
  return db
    .select()
    .from(batteryEvents)
    .where(
      and(
        eq(batteryEvents.batteryId, batteryId),
        eq(batteryEvents.companyId, companyId),
      ),
    );
}
