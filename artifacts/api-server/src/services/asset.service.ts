import { db, assets, assetStatusHistory, type InsertAsset } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

export async function createAsset(data: InsertAsset) {
  const [asset] = await db.insert(assets).values(data).returning();

  await db.insert(assetStatusHistory).values({
    assetId: asset.id,
    newStatus: asset.status,
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
  changedBy?: string,
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
    assetId: id,
    previousStatus: current.status,
    newStatus: newStatus as typeof current.status,
    changedBy: changedBy ?? null,
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
