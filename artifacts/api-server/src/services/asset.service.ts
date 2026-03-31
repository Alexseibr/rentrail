import { db, assets, assetStatusHistory, branches, stations, type InsertAsset } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

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
  if (data.branchId || data.stationId) {
    await validateOwnership(companyId, data.branchId, data.stationId);
  }

  const [asset] = await db
    .update(assets)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.companyId, companyId)))
    .returning();

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }
  return asset;
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

  const [updated] = await db
    .update(assets)
    .set({ status: newStatus as typeof current.status, updatedAt: new Date() })
    .where(eq(assets.id, id))
    .returning();

  await db.insert(assetStatusHistory).values({
    companyId,
    assetId: id,
    fromStatus: current.status,
    toStatus: newStatus as typeof current.status,
    changedByUserId: changedByUserId ?? null,
    reason: reason ?? null,
  });

  return updated;
}

export async function listAssets(companyId: string, branchId?: string, status?: string) {
  let query = db.select().from(assets).where(eq(assets.companyId, companyId));

  if (branchId) {
    query = db.select().from(assets).where(and(eq(assets.companyId, companyId), eq(assets.branchId, branchId)));
  }

  const results = await query;

  if (status) {
    return results.filter((a) => a.status === status);
  }
  return results;
}
