import { db, branches, stations, assets } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AppError } from "./errors";

export async function validateBranchOwnership(
  companyId: string,
  branchId?: string | null,
) {
  if (!branchId) return;
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
    .limit(1);
  if (!branch)
    throw new AppError(
      400,
      "Branch does not belong to this company",
      "INVALID_BRANCH",
    );
}

export async function validateStationOwnership(
  companyId: string,
  stationId?: string | null,
) {
  if (!stationId) return;
  const [station] = await db
    .select({ id: stations.id })
    .from(stations)
    .where(and(eq(stations.id, stationId), eq(stations.companyId, companyId)))
    .limit(1);
  if (!station)
    throw new AppError(
      400,
      "Station does not belong to this company",
      "INVALID_STATION",
    );
}

export async function validateAssetOwnership(
  companyId: string,
  assetId?: string | null,
) {
  if (!assetId) return;
  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)))
    .limit(1);
  if (!asset)
    throw new AppError(
      400,
      "Asset does not belong to this company",
      "INVALID_ASSET",
    );
}

export async function validateForeignKeys(
  companyId: string,
  data: {
    branchId?: string | null;
    stationId?: string | null;
    assetId?: string | null;
  },
) {
  await validateBranchOwnership(companyId, data.branchId);
  await validateStationOwnership(companyId, data.stationId);
  await validateAssetOwnership(companyId, data.assetId);
}
