import { db, assets, assetStatusHistory, branches, stations, type InsertAsset } from "@workspace/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { NotFoundError, AppError, InvalidStatusTransitionError } from "../lib/errors";

type AssetStatus = typeof assets.$inferSelect.status;

const ASSET_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["available", "maintenance", "retired"],
  available: ["reserved", "awaiting_pickup", "rented", "charging", "maintenance", "blocked", "lost", "stolen", "retired"],
  reserved: ["available", "awaiting_pickup", "maintenance", "blocked"],
  awaiting_pickup: ["rented", "available", "maintenance", "blocked"],
  rented: ["available", "overdue", "charging", "maintenance", "lost", "stolen"],
  overdue: ["available", "charging", "maintenance", "blocked", "lost", "stolen"],
  charging: ["available", "maintenance"],
  maintenance: ["available", "retired", "blocked"],
  blocked: ["available", "maintenance", "retired"],
  lost: ["available", "retired"],
  stolen: ["available", "retired"],
  retired: [],
};

const STATUSES_UNAVAILABLE_FOR_RENTAL = [
  "rented", "overdue", "blocked", "lost", "stolen", "retired", "maintenance", "charging",
];

async function validateOwnership(companyId: string, branchId?: string, stationId?: string | null) {
  if (branchId) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
      .limit(1);
    if (!branch) {
      throw new AppError(400, "Branch does not belong to this company", "INVALID_BRANCH");
    }
  }

  if (stationId) {
    const [station] = await db
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.companyId, companyId)))
      .limit(1);
    if (!station) {
      throw new AppError(400, "Station does not belong to this company", "INVALID_STATION");
    }
  }
}

export async function createAsset(data: InsertAsset) {
  await validateOwnership(data.companyId, data.branchId, data.stationId);

  const [asset] = await db.insert(assets).values(data).returning();

  await db.insert(assetStatusHistory).values({
    companyId: asset.companyId,
    assetId: asset.id,
    toStatus: asset.status,
    reason: "Asset created",
  });

  return asset;
}

export async function getAsset(id: string, companyId: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.companyId, companyId)))
    .limit(1);

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }
  return asset;
}

export async function updateAsset(id: string, companyId: string, data: Partial<InsertAsset>) {
  delete (data as Record<string, unknown>).status;
  delete (data as Record<string, unknown>).archivedAt;

  if (data.branchId || data.stationId) {
    await validateOwnership(companyId, data.branchId, data.stationId);
  }

  const [asset] = await db
    .update(assets)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.companyId, companyId), isNull(assets.archivedAt)))
    .returning();

  if (!asset) {
    throw new NotFoundError("Asset not found or archived");
  }
  return asset;
}

export function validateAssetTransition(from: string, to: string) {
  const allowed = ASSET_STATUS_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidStatusTransitionError(from, to, "asset");
  }
}

export async function changeAssetStatus(
  id: string,
  companyId: string,
  newStatus: string,
  changedByUserId?: string,
  reason?: string,
) {
  const [current] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.companyId, companyId)))
    .limit(1);

  if (!current) {
    throw new NotFoundError("Asset not found");
  }

  if (current.archivedAt) {
    throw new AppError(422, "Cannot change status of archived asset", "ASSET_ARCHIVED");
  }

  validateAssetTransition(current.status, newStatus);

  const [updated] = await db
    .update(assets)
    .set({ status: newStatus as AssetStatus, updatedAt: new Date() })
    .where(eq(assets.id, id))
    .returning();

  await db.insert(assetStatusHistory).values({
    companyId,
    assetId: id,
    fromStatus: current.status,
    toStatus: newStatus as AssetStatus,
    changedByUserId: changedByUserId ?? null,
    reason: reason ?? null,
  });

  return updated;
}

export async function archiveAsset(id: string, companyId: string) {
  const [asset] = await db
    .update(assets)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.companyId, companyId), isNull(assets.archivedAt)))
    .returning();

  if (!asset) {
    throw new NotFoundError("Asset not found or already archived");
  }
  return asset;
}

export async function restoreAsset(id: string, companyId: string) {
  const [current] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.companyId, companyId)))
    .limit(1);

  if (!current) throw new NotFoundError("Asset not found");
  if (!current.archivedAt) throw new AppError(422, "Asset is not archived", "NOT_ARCHIVED");

  const [asset] = await db
    .update(assets)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(assets.id, id))
    .returning();

  return asset;
}

export async function getAssetStatusHistory(assetId: string, companyId: string) {
  return db
    .select()
    .from(assetStatusHistory)
    .where(and(eq(assetStatusHistory.assetId, assetId), eq(assetStatusHistory.companyId, companyId)));
}

export function isAvailableForRental(status: string): boolean {
  return !STATUSES_UNAVAILABLE_FOR_RENTAL.includes(status);
}

export async function listAssets(companyId: string, branchId?: string, status?: string) {
  const conditions = [eq(assets.companyId, companyId)];
  if (branchId) conditions.push(eq(assets.branchId, branchId));
  if (status) conditions.push(eq(assets.status, status as AssetStatus));

  return db.select().from(assets).where(and(...conditions));
}
