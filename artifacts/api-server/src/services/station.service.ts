import { db, stations, branches, type InsertStation } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

async function validateBranchOwnership(branchId: string, companyId: string) {
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
    .limit(1);

  if (!branch) {
    throw new AppError(
      400,
      "Branch does not belong to this company",
      "INVALID_BRANCH",
    );
  }
}

export async function createStation(data: InsertStation) {
  await validateBranchOwnership(data.branchId, data.companyId);

  const [station] = await db.insert(stations).values(data).returning();
  return station;
}

export async function getStation(id: string, companyId: string) {
  const [station] = await db
    .select()
    .from(stations)
    .where(and(eq(stations.id, id), eq(stations.companyId, companyId)))
    .limit(1);

  if (!station) {
    throw new NotFoundError("Station not found");
  }
  return station;
}

export async function updateStation(
  id: string,
  companyId: string,
  data: Partial<InsertStation>,
) {
  if (data.branchId) {
    await validateBranchOwnership(data.branchId, companyId);
  }

  const [station] = await db
    .update(stations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(stations.id, id), eq(stations.companyId, companyId)))
    .returning();

  if (!station) {
    throw new NotFoundError("Station not found");
  }
  return station;
}

export async function listStations(companyId: string, branchId?: string) {
  if (branchId) {
    return db
      .select()
      .from(stations)
      .where(
        and(eq(stations.companyId, companyId), eq(stations.branchId, branchId)),
      );
  }
  return db.select().from(stations).where(eq(stations.companyId, companyId));
}
