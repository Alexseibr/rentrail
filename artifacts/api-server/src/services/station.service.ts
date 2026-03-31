import { db, stations, type InsertStation } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

export async function createStation(data: InsertStation) {
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

export async function updateStation(id: string, companyId: string, data: Partial<InsertStation>) {
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
      .where(and(eq(stations.companyId, companyId), eq(stations.branchId, branchId)));
  }
  return db
    .select()
    .from(stations)
    .where(eq(stations.companyId, companyId));
}
