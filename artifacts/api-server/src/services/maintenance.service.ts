import {
  db, maintenanceLogs, maintenanceSchedules, spareParts, sparePartTransactions,
  workOrderParts, workOrders, assets, branches, users, companies,
} from "@workspace/db";
import { eq, and, desc, lte, lt, sql, inArray, isNull, or } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import { logger } from "../lib/logger";

// ─── Maintenance Logs ─────────────────────────────────────────────────────────

export async function listMaintenanceLogs(companyId: string, assetId?: string, limit = 50, logType?: string) {
  const clauses = [eq(maintenanceLogs.companyId, companyId)];
  if (assetId) clauses.push(eq(maintenanceLogs.assetId, assetId));
  if (logType) clauses.push(eq(maintenanceLogs.logType, logType as typeof maintenanceLogs.$inferSelect["logType"]));
  const conditions = and(...clauses);

  return db
    .select({
      id: maintenanceLogs.id,
      assetId: maintenanceLogs.assetId,
      workOrderId: maintenanceLogs.workOrderId,
      logType: maintenanceLogs.logType,
      performedAt: maintenanceLogs.performedAt,
      odometerKm: maintenanceLogs.odometerKm,
      cost: maintenanceLogs.cost,
      partsUsed: maintenanceLogs.partsUsed,
      notes: maintenanceLogs.notes,
      nextServiceKm: maintenanceLogs.nextServiceKm,
      nextServiceDate: maintenanceLogs.nextServiceDate,
      createdAt: maintenanceLogs.createdAt,
      assetCode: assets.internalCode,
      assetType: assets.assetType,
      assetBrand: assets.brand,
      assetModel: assets.model,
      performedByName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(maintenanceLogs)
    .leftJoin(assets, eq(maintenanceLogs.assetId, assets.id))
    .leftJoin(users, eq(maintenanceLogs.performedByUserId, users.id))
    .where(conditions)
    .orderBy(desc(maintenanceLogs.performedAt))
    .limit(limit);
}

export async function createMaintenanceLog(
  companyId: string,
  data: {
    assetId: string;
    branchId?: string;
    workOrderId?: string;
    logType: string;
    performedAt: Date;
    performedByUserId?: string;
    odometerKm?: number;
    cost?: number;
    partsUsed?: string;
    notes?: string;
    nextServiceKm?: number;
    nextServiceDate?: Date;
  },
) {
  const [log] = await db
    .insert(maintenanceLogs)
    .values({
      companyId,
      assetId: data.assetId,
      branchId: data.branchId,
      workOrderId: data.workOrderId,
      logType: data.logType as typeof maintenanceLogs.$inferInsert["logType"],
      performedAt: data.performedAt,
      performedByUserId: data.performedByUserId,
      odometerKm: data.odometerKm?.toString(),
      cost: data.cost?.toString(),
      partsUsed: data.partsUsed,
      notes: data.notes,
      nextServiceKm: data.nextServiceKm?.toString(),
      nextServiceDate: data.nextServiceDate,
    })
    .returning();

  await updateScheduleAfterLog(companyId, data.assetId, data.logType, data.performedAt, data.odometerKm, data.nextServiceKm, data.nextServiceDate);

  return log;
}

async function updateScheduleAfterLog(
  companyId: string,
  assetId: string,
  logType: string,
  performedAt: Date,
  odometerKm?: number,
  nextServiceKm?: number,
  nextServiceDate?: Date,
) {
  const schedules = await db
    .select()
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.companyId, companyId),
        eq(maintenanceSchedules.scheduleType, logType as typeof maintenanceSchedules.$inferSelect["scheduleType"]),
        or(eq(maintenanceSchedules.assetId, assetId), isNull(maintenanceSchedules.assetId)),
        eq(maintenanceSchedules.enabled, true),
      ),
    );

  for (const schedule of schedules) {
    const nowKm = odometerKm?.toString() ?? null;
    const dueKm = nextServiceKm
      ? nextServiceKm.toString()
      : schedule.intervalKm && odometerKm
        ? (odometerKm + parseFloat(schedule.intervalKm)).toString()
        : schedule.nextDueKm;

    const dueAt = nextServiceDate
      ? nextServiceDate
      : schedule.intervalDays
        ? new Date(performedAt.getTime() + schedule.intervalDays * 86400_000)
        : schedule.nextDueAt;

    await db
      .update(maintenanceSchedules)
      .set({
        lastDoneAt: performedAt,
        lastDoneKm: nowKm,
        nextDueKm: dueKm,
        nextDueAt: dueAt,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceSchedules.id, schedule.id));
  }
}

// ─── Maintenance Schedules ────────────────────────────────────────────────────

export async function listMaintenanceSchedules(companyId: string, assetId?: string) {
  const conditions = assetId
    ? and(eq(maintenanceSchedules.companyId, companyId), eq(maintenanceSchedules.assetId, assetId))
    : eq(maintenanceSchedules.companyId, companyId);

  return db
    .select({
      id: maintenanceSchedules.id,
      assetId: maintenanceSchedules.assetId,
      assetType: maintenanceSchedules.assetType,
      scheduleType: maintenanceSchedules.scheduleType,
      name: maintenanceSchedules.name,
      intervalKm: maintenanceSchedules.intervalKm,
      intervalDays: maintenanceSchedules.intervalDays,
      lastDoneKm: maintenanceSchedules.lastDoneKm,
      lastDoneAt: maintenanceSchedules.lastDoneAt,
      nextDueKm: maintenanceSchedules.nextDueKm,
      nextDueAt: maintenanceSchedules.nextDueAt,
      enabled: maintenanceSchedules.enabled,
      assetCode: assets.internalCode,
      assetBrand: assets.brand,
      assetModel: assets.model,
    })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .where(conditions)
    .orderBy(maintenanceSchedules.nextDueAt);
}

export async function getOverdueSchedules(companyId: string) {
  const now = new Date();
  return db
    .select({
      id: maintenanceSchedules.id,
      assetId: maintenanceSchedules.assetId,
      assetType: maintenanceSchedules.assetType,
      scheduleType: maintenanceSchedules.scheduleType,
      name: maintenanceSchedules.name,
      nextDueKm: maintenanceSchedules.nextDueKm,
      nextDueAt: maintenanceSchedules.nextDueAt,
      lastDoneAt: maintenanceSchedules.lastDoneAt,
      assetCode: assets.internalCode,
      assetBrand: assets.brand,
      assetModel: assets.model,
    })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .where(
      and(
        eq(maintenanceSchedules.companyId, companyId),
        eq(maintenanceSchedules.enabled, true),
        lte(maintenanceSchedules.nextDueAt, now),
      ),
    )
    .orderBy(maintenanceSchedules.nextDueAt);
}

export async function createMaintenanceSchedule(
  companyId: string,
  data: {
    assetId?: string;
    assetType?: string;
    scheduleType: string;
    name: string;
    intervalKm?: number;
    intervalDays?: number;
    lastDoneKm?: number;
    lastDoneAt?: Date;
  },
) {
  const nextDueAt = data.lastDoneAt && data.intervalDays
    ? new Date(data.lastDoneAt.getTime() + data.intervalDays * 86400_000)
    : data.intervalDays ? new Date(Date.now() + data.intervalDays * 86400_000) : undefined;

  const nextDueKm = data.lastDoneKm && data.intervalKm
    ? (data.lastDoneKm + data.intervalKm).toString()
    : undefined;

  const [schedule] = await db
    .insert(maintenanceSchedules)
    .values({
      companyId,
      assetId: data.assetId,
      assetType: data.assetType as typeof maintenanceSchedules.$inferInsert["assetType"],
      scheduleType: data.scheduleType as typeof maintenanceSchedules.$inferInsert["scheduleType"],
      name: data.name,
      intervalKm: data.intervalKm?.toString(),
      intervalDays: data.intervalDays,
      lastDoneKm: data.lastDoneKm?.toString(),
      lastDoneAt: data.lastDoneAt,
      nextDueKm,
      nextDueAt,
    })
    .returning();
  return schedule;
}

export async function updateMaintenanceSchedule(id: string, companyId: string, data: Record<string, unknown>) {
  const [row] = await db
    .update(maintenanceSchedules)
    .set({ ...data, updatedAt: new Date() } as Partial<typeof maintenanceSchedules.$inferInsert> & { updatedAt: Date })
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.companyId, companyId)))
    .returning();
  if (!row) throw new NotFoundError("Schedule not found");
  return row;
}

export async function deleteMaintenanceSchedule(id: string, companyId: string) {
  const [row] = await db
    .delete(maintenanceSchedules)
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.companyId, companyId)))
    .returning({ id: maintenanceSchedules.id });
  if (!row) throw new NotFoundError("Schedule not found");
}

// ─── Spare Parts ──────────────────────────────────────────────────────────────

export async function listSpareParts(companyId: string, branchId?: string, lowStockOnly = false) {
  const rows = await db
    .select()
    .from(spareParts)
    .where(
      branchId
        ? and(eq(spareParts.companyId, companyId), eq(spareParts.branchId, branchId))
        : eq(spareParts.companyId, companyId),
    )
    .orderBy(spareParts.category, spareParts.name);

  if (lowStockOnly) {
    return rows.filter(
      (p) => parseFloat(p.qtyInStock) <= parseFloat(p.minQtyAlert),
    );
  }
  return rows;
}

export async function getSparePart(id: string, companyId: string) {
  const [part] = await db
    .select()
    .from(spareParts)
    .where(and(eq(spareParts.id, id), eq(spareParts.companyId, companyId)))
    .limit(1);
  if (!part) throw new NotFoundError("Spare part not found");
  return part;
}

export async function createSparePart(companyId: string, data: {
  branchId?: string;
  name: string;
  sku?: string;
  category: string;
  unit?: string;
  qtyInStock?: number;
  minQtyAlert?: number;
  costPrice?: number;
  location?: string;
  notes?: string;
}) {
  const [part] = await db
    .insert(spareParts)
    .values({
      companyId,
      branchId: data.branchId,
      name: data.name,
      sku: data.sku,
      category: data.category as typeof spareParts.$inferInsert["category"],
      unit: data.unit ?? "шт",
      qtyInStock: data.qtyInStock?.toString() ?? "0",
      minQtyAlert: data.minQtyAlert?.toString() ?? "0",
      costPrice: data.costPrice?.toString(),
      location: data.location,
      notes: data.notes,
    })
    .returning();
  return part;
}

export async function updateSparePart(id: string, companyId: string, data: Record<string, unknown>) {
  const [row] = await db
    .update(spareParts)
    .set({ ...data, updatedAt: new Date() } as Partial<typeof spareParts.$inferInsert> & { updatedAt: Date })
    .where(and(eq(spareParts.id, id), eq(spareParts.companyId, companyId)))
    .returning();
  if (!row) throw new NotFoundError("Spare part not found");
  return row;
}

export async function deleteSparePart(id: string, companyId: string) {
  const [row] = await db
    .delete(spareParts)
    .where(and(eq(spareParts.id, id), eq(spareParts.companyId, companyId)))
    .returning({ id: spareParts.id });
  if (!row) throw new NotFoundError("Spare part not found");
}

// ─── Spare Part Transactions ──────────────────────────────────────────────────

export async function listSparePartTransactions(companyId: string, partId?: string, limit = 100) {
  const conditions = partId
    ? and(eq(sparePartTransactions.companyId, companyId), eq(sparePartTransactions.partId, partId))
    : eq(sparePartTransactions.companyId, companyId);

  return db
    .select({
      id: sparePartTransactions.id,
      partId: sparePartTransactions.partId,
      workOrderId: sparePartTransactions.workOrderId,
      transactionType: sparePartTransactions.transactionType,
      qty: sparePartTransactions.qty,
      unitCost: sparePartTransactions.unitCost,
      notes: sparePartTransactions.notes,
      createdAt: sparePartTransactions.createdAt,
      partName: spareParts.name,
      partSku: spareParts.sku,
      partUnit: spareParts.unit,
      performedByName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(sparePartTransactions)
    .leftJoin(spareParts, eq(sparePartTransactions.partId, spareParts.id))
    .leftJoin(users, eq(sparePartTransactions.performedByUserId, users.id))
    .where(conditions)
    .orderBy(desc(sparePartTransactions.createdAt))
    .limit(limit);
}

export async function createSparePartTransaction(
  companyId: string,
  userId: string,
  data: {
    partId: string;
    workOrderId?: string;
    transactionType: string;
    qty: number;
    unitCost?: number;
    notes?: string;
  },
) {
  const part = await getSparePart(data.partId, companyId);

  const currentQty = parseFloat(part.qtyInStock);
  const isOut = data.transactionType === "out" || data.transactionType === "write_off";
  const newQty = isOut ? currentQty - data.qty : currentQty + data.qty;

  if (isOut && newQty < 0) {
    throw new AppError(400, `Недостаточно запчастей на складе. Доступно: ${currentQty} ${part.unit}`, "INSUFFICIENT_STOCK");
  }

  const [transaction] = await db
    .insert(sparePartTransactions)
    .values({
      companyId,
      partId: data.partId,
      workOrderId: data.workOrderId,
      transactionType: data.transactionType as typeof sparePartTransactions.$inferInsert["transactionType"],
      qty: data.qty.toString(),
      unitCost: data.unitCost?.toString(),
      notes: data.notes,
      performedByUserId: userId,
    })
    .returning();

  await db
    .update(spareParts)
    .set({ qtyInStock: newQty.toString(), updatedAt: new Date() })
    .where(eq(spareParts.id, data.partId));

  logger.info({ partId: data.partId, type: data.transactionType, qty: data.qty, newQty }, "Spare part transaction created");

  return transaction;
}

// ─── Work Order Parts ─────────────────────────────────────────────────────────

export async function listWorkOrderParts(workOrderId: string) {
  return db
    .select({
      id: workOrderParts.id,
      workOrderId: workOrderParts.workOrderId,
      partId: workOrderParts.partId,
      qtyUsed: workOrderParts.qtyUsed,
      unitCost: workOrderParts.unitCost,
      partName: spareParts.name,
      partSku: spareParts.sku,
      partUnit: spareParts.unit,
      partCategory: spareParts.category,
    })
    .from(workOrderParts)
    .leftJoin(spareParts, eq(workOrderParts.partId, spareParts.id))
    .where(eq(workOrderParts.workOrderId, workOrderId));
}

export async function addPartToWorkOrder(
  workOrderId: string,
  companyId: string,
  userId: string,
  data: { partId: string; qtyUsed: number; unitCost?: number },
) {
  const [wo] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.companyId, companyId)))
    .limit(1);
  if (!wo) throw new NotFoundError("Work order not found");

  await createSparePartTransaction(companyId, userId, {
    partId: data.partId,
    workOrderId,
    transactionType: "out",
    qty: data.qtyUsed,
    unitCost: data.unitCost,
    notes: `Использовано в наряде ${workOrderId}`,
  });

  const [existing] = await db
    .select()
    .from(workOrderParts)
    .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.partId, data.partId)))
    .limit(1);

  if (existing) {
    const newQty = parseFloat(existing.qtyUsed) + data.qtyUsed;
    const [updated] = await db
      .update(workOrderParts)
      .set({ qtyUsed: newQty.toString(), updatedAt: new Date() })
      .where(eq(workOrderParts.id, existing.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(workOrderParts)
    .values({
      workOrderId,
      partId: data.partId,
      qtyUsed: data.qtyUsed.toString(),
      unitCost: data.unitCost?.toString(),
    })
    .returning();
  return row;
}

export async function removePartFromWorkOrder(id: string, workOrderId: string, companyId: string, userId: string) {
  const [part] = await db
    .select()
    .from(workOrderParts)
    .where(and(eq(workOrderParts.id, id), eq(workOrderParts.workOrderId, workOrderId)))
    .limit(1);
  if (!part) throw new NotFoundError("Work order part not found");

  await createSparePartTransaction(companyId, userId, {
    partId: part.partId,
    workOrderId,
    transactionType: "in",
    qty: parseFloat(part.qtyUsed),
    notes: `Возврат из наряда ${workOrderId}`,
  });

  await db.delete(workOrderParts).where(eq(workOrderParts.id, id));
}

// ─── Service Analytics ────────────────────────────────────────────────────────

export async function getServiceStats(companyId: string) {
  const [overdueCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.companyId, companyId),
        eq(maintenanceSchedules.enabled, true),
        lte(maintenanceSchedules.nextDueAt, new Date()),
      ),
    );

  const [lowStockCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spareParts)
    .where(
      and(
        eq(spareParts.companyId, companyId),
        sql`${spareParts.qtyInStock}::numeric <= ${spareParts.minQtyAlert}::numeric`,
      ),
    );

  const [monthCost] = await db
    .select({ total: sql<number>`coalesce(sum(${maintenanceLogs.cost}::numeric), 0)::float` })
    .from(maintenanceLogs)
    .where(
      and(
        eq(maintenanceLogs.companyId, companyId),
        sql`${maintenanceLogs.performedAt} >= date_trunc('month', now())`,
      ),
    );

  const costByAsset = await db
    .select({
      assetId: maintenanceLogs.assetId,
      assetCode: assets.internalCode,
      assetBrand: assets.brand,
      assetModel: assets.model,
      totalCost: sql<number>`coalesce(sum(${maintenanceLogs.cost}::numeric), 0)::float`,
      logCount: sql<number>`count(*)::int`,
    })
    .from(maintenanceLogs)
    .leftJoin(assets, eq(maintenanceLogs.assetId, assets.id))
    .where(eq(maintenanceLogs.companyId, companyId))
    .groupBy(maintenanceLogs.assetId, assets.internalCode, assets.brand, assets.model)
    .orderBy(sql`totalCost desc`)
    .limit(10);

  return {
    overdueSchedulesCount: overdueCount?.count ?? 0,
    lowStockPartsCount: lowStockCount?.count ?? 0,
    monthlyMaintenanceCost: monthCost?.total ?? 0,
    costByAsset,
  };
}
