import { db, geofences } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import { validateBranchOwnership, validateStationOwnership } from "../lib/validate-ownership";

type GeofenceType = typeof geofences.$inferSelect.type;

export async function createGeofence(companyId: string, data: {
  branchId?: string; stationId?: string; name: string; type: string;
  geometry: unknown; rules?: unknown;
}) {
  await validateBranchOwnership(companyId, data.branchId);
  await validateStationOwnership(companyId, data.stationId);

  const [geo] = await db.insert(geofences).values({
    companyId, branchId: data.branchId ?? null, stationId: data.stationId ?? null,
    name: data.name, type: data.type as GeofenceType, geometry: data.geometry, rules: data.rules ?? null,
  }).returning();
  return geo;
}

export async function getGeofence(id: string, companyId: string) {
  const [geo] = await db.select().from(geofences)
    .where(and(eq(geofences.id, id), eq(geofences.companyId, companyId))).limit(1);
  if (!geo) throw new NotFoundError("Geofence not found");
  return geo;
}

export async function listGeofences(companyId: string, filters?: { type?: string; branchId?: string; isActive?: boolean }) {
  const conditions = [eq(geofences.companyId, companyId), isNull(geofences.archivedAt)];
  if (filters?.type) conditions.push(eq(geofences.type, filters.type as GeofenceType));
  if (filters?.branchId) conditions.push(eq(geofences.branchId, filters.branchId));
  if (filters?.isActive !== undefined) conditions.push(eq(geofences.isActive, filters.isActive));
  return db.select().from(geofences).where(and(...conditions));
}

export async function updateGeofence(id: string, companyId: string, data: Record<string, unknown>) {
  delete data.companyId; delete data.id;
  const [updated] = await db.update(geofences).set({ ...data, updatedAt: new Date() } as Partial<typeof geofences.$inferInsert> & { updatedAt: Date })
    .where(and(eq(geofences.id, id), eq(geofences.companyId, companyId))).returning();
  if (!updated) throw new NotFoundError("Geofence not found");
  return updated;
}

export async function archiveGeofence(id: string, companyId: string) {
  const geo = await getGeofence(id, companyId);
  if (geo.archivedAt) throw new AppError(409, "Geofence already archived", "ALREADY_ARCHIVED");
  const [updated] = await db.update(geofences).set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(geofences.id, id), eq(geofences.companyId, companyId))).returning();
  return updated;
}

export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export async function getActiveGeofencesForCompany(companyId: string) {
  return db.select().from(geofences)
    .where(and(eq(geofences.companyId, companyId), eq(geofences.isActive, true), isNull(geofences.archivedAt)));
}

export function evaluatePointAgainstGeofences(lat: number, lng: number, geoList: typeof geofences.$inferSelect[]) {
  const results: Array<{ geofenceId: string; name: string; type: string; inside: boolean }> = [];
  for (const geo of geoList) {
    const geom = geo.geometry as { type?: string; coordinates?: number[][] };
    if (geom?.type === "Polygon" && Array.isArray(geom.coordinates)) {
      const polygon = geom.coordinates as unknown as [number, number][];
      const inside = pointInPolygon([lng, lat], polygon);
      results.push({ geofenceId: geo.id, name: geo.name, type: geo.type, inside });
    }
  }
  return results;
}
