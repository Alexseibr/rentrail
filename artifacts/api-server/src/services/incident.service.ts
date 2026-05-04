import { db, incidents, branches, users } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

type IncidentStatus = typeof incidents.$inferSelect.status;

export async function listIncidents(companyId: string, branchId?: string, status?: string) {
  const conditions = [eq(incidents.companyId, companyId)];
  if (branchId) conditions.push(eq(incidents.branchId, branchId));
  if (status) conditions.push(eq(incidents.status, status as IncidentStatus));

  const rows = await db
    .select({
      id: incidents.id,
      companyId: incidents.companyId,
      branchId: incidents.branchId,
      title: incidents.title,
      description: incidents.description,
      severity: incidents.severity,
      status: incidents.status,
      reportedByUserId: incidents.reportedByUserId,
      assignedToUserId: incidents.assignedToUserId,
      resolvedAt: incidents.resolvedAt,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      branchName: branches.name,
      branchCity: branches.city,
      assignedToName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(incidents)
    .leftJoin(branches, eq(incidents.branchId, branches.id))
    .leftJoin(users, eq(incidents.assignedToUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(incidents.createdAt));

  return rows;
}

export async function getIncident(id: string, companyId: string) {
  const [row] = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.id, id), eq(incidents.companyId, companyId)));
  return row;
}

export async function createIncident(data: {
  companyId: string;
  branchId?: string;
  title: string;
  description?: string;
  severity?: string;
  reportedByUserId?: string;
}) {
  const [row] = await db
    .insert(incidents)
    .values(data as typeof incidents.$inferInsert)
    .returning();
  return row;
}

export async function updateIncident(id: string, companyId: string, data: Record<string, unknown>) {
  const [row] = await db
    .update(incidents)
    .set({ ...data, updatedAt: new Date() } as Partial<typeof incidents.$inferInsert> & { updatedAt: Date })
    .where(and(eq(incidents.id, id), eq(incidents.companyId, companyId)))
    .returning();
  return row;
}
