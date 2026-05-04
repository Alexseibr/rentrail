import { db, serviceRequests, workOrders, users, assets, branches, userCompanyMemberships, roles } from "@workspace/db";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";

type ServiceRequestStatus = typeof serviceRequests.$inferSelect.status;
type WorkOrderStatus = typeof workOrders.$inferSelect.status;

const userFullName = sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`.as("assigned_to_name");

export async function listServiceRequests(companyId: string, branchId?: string, status?: string) {
  const rows = await db
    .select({
      id: serviceRequests.id,
      companyId: serviceRequests.companyId,
      branchId: serviceRequests.branchId,
      assetId: serviceRequests.assetId,
      requestType: serviceRequests.requestType,
      priority: serviceRequests.priority,
      status: serviceRequests.status,
      title: serviceRequests.title,
      description: serviceRequests.description,
      lat: serviceRequests.lat,
      lng: serviceRequests.lng,
      locationAddress: serviceRequests.locationAddress,
      assignedToUserId: serviceRequests.assignedToUserId,
      resolvedAt: serviceRequests.resolvedAt,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      assetCode: assets.internalCode,
      assetType: assets.assetType,
      branchName: branches.name,
      branchCity: branches.city,
      assignedToName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(serviceRequests)
    .leftJoin(assets, eq(serviceRequests.assetId, assets.id))
    .leftJoin(branches, eq(serviceRequests.branchId, branches.id))
    .leftJoin(users, eq(serviceRequests.assignedToUserId, users.id))
    .where(
      branchId
        ? and(eq(serviceRequests.companyId, companyId), eq(serviceRequests.branchId, branchId), status ? eq(serviceRequests.status, status as ServiceRequestStatus) : undefined)
        : and(eq(serviceRequests.companyId, companyId), status ? eq(serviceRequests.status, status as ServiceRequestStatus) : undefined)
    )
    .orderBy(desc(serviceRequests.createdAt));
  return rows;
}

export async function getServiceRequest(id: string, companyId: string) {
  const [row] = await db
    .select({
      id: serviceRequests.id,
      companyId: serviceRequests.companyId,
      branchId: serviceRequests.branchId,
      assetId: serviceRequests.assetId,
      clientId: serviceRequests.clientId,
      requestType: serviceRequests.requestType,
      priority: serviceRequests.priority,
      status: serviceRequests.status,
      title: serviceRequests.title,
      description: serviceRequests.description,
      lat: serviceRequests.lat,
      lng: serviceRequests.lng,
      locationAddress: serviceRequests.locationAddress,
      assignedToUserId: serviceRequests.assignedToUserId,
      reportedByUserId: serviceRequests.reportedByUserId,
      resolvedAt: serviceRequests.resolvedAt,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      assetCode: assets.internalCode,
      assetType: assets.assetType,
      branchName: branches.name,
      branchCity: branches.city,
      assignedToName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(serviceRequests)
    .leftJoin(assets, eq(serviceRequests.assetId, assets.id))
    .leftJoin(branches, eq(serviceRequests.branchId, branches.id))
    .leftJoin(users, eq(serviceRequests.assignedToUserId, users.id))
    .where(and(eq(serviceRequests.id, id), eq(serviceRequests.companyId, companyId)));
  return row;
}

export async function createServiceRequest(data: {
  companyId: string;
  branchId: string;
  assetId?: string;
  clientId?: string;
  requestType: string;
  priority?: string;
  title: string;
  description?: string;
  reportedByUserId?: string;
  lat?: number;
  lng?: number;
  locationAddress?: string;
}) {
  const [row] = await db.insert(serviceRequests).values(data as typeof serviceRequests.$inferInsert).returning();
  return row;
}

export async function updateServiceRequest(id: string, companyId: string, data: Record<string, unknown>) {
  const [row] = await db
    .update(serviceRequests)
    .set({ ...data, updatedAt: new Date() } as Partial<typeof serviceRequests.$inferInsert> & { updatedAt: Date })
    .where(and(eq(serviceRequests.id, id), eq(serviceRequests.companyId, companyId)))
    .returning();
  return row;
}

export async function listWorkOrders(companyId: string, branchId?: string, status?: string, assignedToUserId?: string) {
  const conditions = [eq(workOrders.companyId, companyId)];
  if (branchId) conditions.push(eq(workOrders.branchId, branchId));
  if (status) conditions.push(eq(workOrders.status, status as WorkOrderStatus));
  if (assignedToUserId) conditions.push(eq(workOrders.assignedToUserId, assignedToUserId));

  const rows = await db
    .select({
      id: workOrders.id,
      companyId: workOrders.companyId,
      branchId: workOrders.branchId,
      serviceRequestId: workOrders.serviceRequestId,
      assetId: workOrders.assetId,
      orderType: workOrders.orderType,
      priority: workOrders.priority,
      status: workOrders.status,
      title: workOrders.title,
      description: workOrders.description,
      assignedToUserId: workOrders.assignedToUserId,
      estimatedCost: workOrders.estimatedCost,
      actualCost: workOrders.actualCost,
      resolution: workOrders.resolution,
      startedAt: workOrders.startedAt,
      completedAt: workOrders.completedAt,
      createdAt: workOrders.createdAt,
      assetCode: assets.internalCode,
      assetType: assets.assetType,
      branchName: branches.name,
      branchCity: branches.city,
      assignedToName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(branches, eq(workOrders.branchId, branches.id))
    .leftJoin(users, eq(workOrders.assignedToUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(workOrders.createdAt));
  return rows;
}

export async function createWorkOrder(data: {
  companyId: string;
  branchId?: string;
  serviceRequestId?: string;
  assetId?: string;
  orderType: string;
  priority?: string;
  title: string;
  description?: string;
  assignedToUserId?: string;
  createdByUserId?: string;
  estimatedCost?: string;
}) {
  const insertData: typeof workOrders.$inferInsert = {
    companyId: data.companyId,
    orderType: data.orderType as typeof workOrders.$inferInsert["orderType"],
    priority: (data.priority ?? "medium") as typeof workOrders.$inferInsert["priority"],
    title: data.title,
    status: "draft",
  };
  if (data.branchId) insertData.branchId = data.branchId;
  if (data.serviceRequestId) insertData.serviceRequestId = data.serviceRequestId;
  if (data.assetId) insertData.assetId = data.assetId;
  if (data.description) insertData.description = data.description;
  if (data.assignedToUserId) insertData.assignedToUserId = data.assignedToUserId;
  if (data.createdByUserId) insertData.createdByUserId = data.createdByUserId;
  if (data.estimatedCost) insertData.estimatedCost = data.estimatedCost;

  const [row] = await db.insert(workOrders).values(insertData).returning();
  return row;
}

export async function updateWorkOrder(id: string, companyId: string, data: Record<string, unknown>) {
  const [row] = await db
    .update(workOrders)
    .set({ ...data, updatedAt: new Date() } as Partial<typeof workOrders.$inferInsert> & { updatedAt: Date })
    .where(and(eq(workOrders.id, id), eq(workOrders.companyId, companyId)))
    .returning();
  return row;
}

export async function getMechanics(companyId: string, branchId?: string) {
  const mechanicRole = await db.select().from(roles).where(eq(roles.code, "mechanic")).then(r => r[0]);
  if (!mechanicRole) return [];

  const rows = await db
    .select({
      userId: userCompanyMemberships.userId,
      fullName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      phone: users.phone,
    })
    .from(userCompanyMemberships)
    .innerJoin(users, eq(userCompanyMemberships.userId, users.id))
    .where(
      and(
        eq(userCompanyMemberships.companyId, companyId),
        eq(userCompanyMemberships.roleId, mechanicRole.id),
        eq(userCompanyMemberships.status, "active")
      )
    );
  return rows;
}
export async function getWorkOrder(id: string, companyId: string) {
  const [row] = await db
    .select({
      id: workOrders.id,
      companyId: workOrders.companyId,
      branchId: workOrders.branchId,
      serviceRequestId: workOrders.serviceRequestId,
      assetId: workOrders.assetId,
      orderType: workOrders.orderType,
      priority: workOrders.priority,
      status: workOrders.status,
      title: workOrders.title,
      description: workOrders.description,
      assignedToUserId: workOrders.assignedToUserId,
      estimatedCost: workOrders.estimatedCost,
      actualCost: workOrders.actualCost,
      partsUsed: workOrders.partsUsed,
      resolution: workOrders.resolution,
      startedAt: workOrders.startedAt,
      completedAt: workOrders.completedAt,
      createdAt: workOrders.createdAt,
      updatedAt: workOrders.updatedAt,
      assetCode: assets.internalCode,
      assetType: assets.assetType,
      assetBrand: assets.brand,
      assetModel: assets.model,
      branchName: branches.name,
      assignedToName: sql`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(branches, eq(workOrders.branchId, branches.id))
    .leftJoin(users, eq(workOrders.assignedToUserId, users.id))
    .where(and(eq(workOrders.id, id), eq(workOrders.companyId, companyId)))
    .limit(1);
  return row ?? null;
}
