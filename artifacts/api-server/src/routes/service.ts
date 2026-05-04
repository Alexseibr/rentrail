import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as serviceService from "../services/service.service";
import * as maintenanceService from "../services/maintenance.service";
import { logger } from "../lib/logger";

const router = Router();

router.get("/service-requests", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await serviceService.listServiceRequests(
      req.tenant!.companyId,
      req.query.branchId as string | undefined,
      req.query.status as string | undefined
    );
    return res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /service-requests error");
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.get("/service-requests/:id", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  const item = await serviceService.getServiceRequest(req.params.id as string, req.tenant!.companyId);
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ data: item });
});

router.post("/service-requests", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  const item = await serviceService.createServiceRequest({
    companyId: req.tenant!.companyId,
    branchId: req.body.branchId,
    assetId: req.body.assetId,
    clientId: req.body.clientId,
    requestType: req.body.requestType,
    priority: req.body.priority,
    title: req.body.title,
    description: req.body.description,
    reportedByUserId: req.user!.userId,
    lat: req.body.lat,
    lng: req.body.lng,
    locationAddress: req.body.locationAddress,
  });
  return res.status(201).json({ data: item });
});

const ALLOWED_SR_PATCH_FIELDS = ["priority", "title", "description", "locationAddress"] as const;

router.patch("/service-requests/:id", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  const safeData: Record<string, unknown> = {};
  for (const key of ALLOWED_SR_PATCH_FIELDS) {
    if (req.body[key] !== undefined) safeData[key] = req.body[key];
  }
  if (Object.keys(safeData).length === 0) return res.status(400).json({ error: "No valid fields to update" });
  const item = await serviceService.updateServiceRequest(req.params.id as string, req.tenant!.companyId, safeData);
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ data: item });
});

router.post("/service-requests/:id/assign", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  const item = await serviceService.updateServiceRequest(req.params.id as string, req.tenant!.companyId, {
    assignedToUserId: req.body.assignedToUserId,
    status: "assigned",
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ data: item });
});

router.post("/service-requests/:id/status", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  const update: Record<string, unknown> = { status: req.body.status };
  if (req.body.status === "completed") update.resolvedAt = new Date();
  const item = await serviceService.updateServiceRequest(req.params.id as string, req.tenant!.companyId, update);
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ data: item });
});

router.get("/work-orders", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await serviceService.listWorkOrders(
      req.tenant!.companyId,
      req.query.branchId as string | undefined,
      req.query.status as string | undefined,
      req.query.assignedToUserId as string | undefined
    );
    return res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /work-orders error");
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.post("/work-orders", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    if (!req.body.title || !req.body.orderType) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "title, orderType required" } });
    }
    const item = await serviceService.createWorkOrder({
      companyId: req.tenant!.companyId,
      branchId: req.body.branchId,
      serviceRequestId: req.body.serviceRequestId,
      assetId: req.body.assetId,
      orderType: req.body.orderType,
      priority: req.body.priority,
      title: req.body.title,
      description: req.body.description,
      assignedToUserId: req.body.assignedToUserId,
      createdByUserId: req.user!.userId,
      estimatedCost: req.body.estimatedCost,
    });
    return res.status(201).json({ data: item });
  } catch (err: any) {
    logger.error({ err }, "POST /work-orders error");
    return res.status(err.statusCode ?? 500).json({ error: { code: err.code ?? "INTERNAL_ERROR", message: err?.message } });
  }
});

const ALLOWED_WO_PATCH_FIELDS = ["priority", "title", "description", "estimatedCost"] as const;

router.patch("/work-orders/:id", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  const safeData: Record<string, unknown> = {};
  for (const key of ALLOWED_WO_PATCH_FIELDS) {
    if (req.body[key] !== undefined) safeData[key] = req.body[key];
  }
  if (Object.keys(safeData).length === 0) return res.status(400).json({ error: "No valid fields to update" });
  const item = await serviceService.updateWorkOrder(req.params.id as string, req.tenant!.companyId, safeData);
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ data: item });
});

router.post("/work-orders/:id/status", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  const update: Record<string, unknown> = { status: req.body.status };
  if (req.body.status === "in_progress") update.startedAt = new Date();
  if (req.body.status === "completed") {
    update.completedAt = new Date();
    if (req.body.resolution) update.resolution = req.body.resolution;
    if (req.body.actualCost) update.actualCost = req.body.actualCost;
    if (req.body.partsUsed) update.partsUsed = req.body.partsUsed;
  }
  const item = await serviceService.updateWorkOrder(req.params.id as string, req.tenant!.companyId, update);
  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ data: item });
});

router.get("/mechanics", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await serviceService.getMechanics(
      req.tenant!.companyId,
      req.query.branchId as string | undefined
    );
    return res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /mechanics error");
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.get("/fleet-map", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const { db: dbImport } = await import("@workspace/db");
    const { assets: assetsTable } = await import("@workspace/db/schema");
    const { eq, sql } = await import("drizzle-orm");

    const companyId = req.tenant!.companyId;

    const assetRows = await dbImport
      .select({
        id: assetsTable.id,
        internalCode: assetsTable.internalCode,
        assetType: assetsTable.assetType,
        status: assetsTable.status,
        brand: assetsTable.brand,
        model: assetsTable.model,
        branchId: assetsTable.branchId,
      })
      .from(assetsTable)
      .where(eq(assetsTable.companyId, companyId));

    const latestResult = await dbImport.execute(sql`
      SELECT DISTINCT ON (asset_id)
        asset_id AS "assetId",
        lat, lng,
        battery_percent AS "batteryPercent",
        speed,
        lock_state AS "lockState",
        recorded_at AS "recordedAt"
      FROM telemetry_snapshots
      WHERE company_id = ${companyId}
      ORDER BY asset_id, recorded_at DESC
    `);

    const snapRows = Array.isArray(latestResult) ? latestResult : (latestResult as any).rows ?? [];
    const latestByAsset = new Map<string, any>();
    for (const snap of snapRows) {
      if (snap.assetId) latestByAsset.set(snap.assetId, snap);
    }

    const result = assetRows.map((asset) => {
      const snap = latestByAsset.get(asset.id);
      return {
        ...asset,
        lat: snap?.lat ?? null,
        lng: snap?.lng ?? null,
        batteryPercent: snap?.batteryPercent ?? null,
        speed: snap?.speed ?? null,
        lockState: snap?.lockState ?? null,
        lastSeen: snap?.recordedAt ?? null,
      };
    });

    return res.json({ data: result });
  } catch (err: any) {
    logger.error({ err }, "GET /fleet-map error");
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

// ─── Maintenance Logs ──────────────────────────────────────────────────────────

router.get("/maintenance-logs", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await maintenanceService.listMaintenanceLogs(
      req.tenant!.companyId,
      req.query.assetId as string | undefined,
      req.query.limit ? parseInt(req.query.limit as string) : 50,
    );
    return res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /maintenance-logs error");
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.post("/maintenance-logs", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.assetId || !body.logType) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "assetId, logType required" } });
    }
    const item = await maintenanceService.createMaintenanceLog(req.tenant!.companyId, {
      assetId: body.assetId,
      branchId: body.branchId,
      workOrderId: body.workOrderId,
      logType: body.logType,
      performedAt: body.performedAt ? new Date(body.performedAt) : new Date(),
      performedByUserId: body.performedByUserId ?? req.user!.userId,
      odometerKm: body.odometerKm,
      cost: body.cost,
      partsUsed: body.partsUsed,
      notes: body.notes,
      nextServiceKm: body.nextServiceKm,
      nextServiceDate: body.nextServiceDate ? new Date(body.nextServiceDate) : undefined,
    });
    return res.status(201).json({ data: item });
  } catch (err: any) {
    logger.error({ err }, "POST /maintenance-logs error");
    return res.status(err.statusCode ?? 500).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

// ─── Maintenance Schedules ─────────────────────────────────────────────────────

router.get("/maintenance-schedules", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await maintenanceService.listMaintenanceSchedules(
      req.tenant!.companyId,
      req.query.assetId as string | undefined,
    );
    return res.json({ data: items });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.get("/maintenance-schedules/overdue", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await maintenanceService.getOverdueSchedules(req.tenant!.companyId);
    return res.json({ data: items });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.post("/maintenance-schedules", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.scheduleType || !body.name) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "scheduleType, name required" } });
    }
    const item = await maintenanceService.createMaintenanceSchedule(req.tenant!.companyId, {
      assetId: body.assetId,
      assetType: body.assetType,
      scheduleType: body.scheduleType,
      name: body.name,
      intervalKm: body.intervalKm,
      intervalDays: body.intervalDays,
      lastDoneKm: body.lastDoneKm,
      lastDoneAt: body.lastDoneAt ? new Date(body.lastDoneAt) : undefined,
    });
    return res.status(201).json({ data: item });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.patch("/maintenance-schedules/:id", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const ALLOWED = ["name", "intervalKm", "intervalDays", "nextDueKm", "nextDueAt", "enabled"] as const;
    const safe: Record<string, unknown> = {};
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) safe[k] = req.body[k];
    }
    const item = await maintenanceService.updateMaintenanceSchedule(String(req.params.id), req.tenant!.companyId, safe);
    return res.json({ data: item });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

router.delete("/maintenance-schedules/:id", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    await maintenanceService.deleteMaintenanceSchedule(String(req.params.id), req.tenant!.companyId);
    return res.status(204).send();
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

// ─── Spare Parts ───────────────────────────────────────────────────────────────

router.get("/spare-parts", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await maintenanceService.listSpareParts(
      req.tenant!.companyId,
      req.query.branchId as string | undefined,
      req.query.lowStock === "true",
    );
    return res.json({ data: items });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.get("/spare-parts/:id", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const item = await maintenanceService.getSparePart(String(req.params.id), req.tenant!.companyId);
    return res.json({ data: item });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

router.post("/spare-parts", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.category) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "name, category required" } });
    }
    const item = await maintenanceService.createSparePart(req.tenant!.companyId, {
      branchId: body.branchId,
      name: body.name,
      sku: body.sku,
      category: body.category,
      unit: body.unit,
      qtyInStock: body.qtyInStock,
      minQtyAlert: body.minQtyAlert,
      costPrice: body.costPrice,
      location: body.location,
      notes: body.notes,
    });
    return res.status(201).json({ data: item });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.patch("/spare-parts/:id", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const ALLOWED = ["name", "sku", "category", "unit", "minQtyAlert", "costPrice", "location", "notes"] as const;
    const safe: Record<string, unknown> = {};
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) safe[k] = req.body[k];
    }
    const item = await maintenanceService.updateSparePart(String(req.params.id), req.tenant!.companyId, safe);
    return res.json({ data: item });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

router.delete("/spare-parts/:id", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    await maintenanceService.deleteSparePart(String(req.params.id), req.tenant!.companyId);
    return res.status(204).send();
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

router.get("/spare-parts/:id/transactions", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await maintenanceService.listSparePartTransactions(
      req.tenant!.companyId,
      String(req.params.id),
      req.query.limit ? parseInt(req.query.limit as string) : 100,
    );
    return res.json({ data: items });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.post("/spare-parts/transactions", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.partId || !body.transactionType || body.qty == null) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "partId, transactionType, qty required" } });
    }
    const item = await maintenanceService.createSparePartTransaction(
      req.tenant!.companyId,
      req.user!.userId,
      {
        partId: body.partId,
        workOrderId: body.workOrderId,
        transactionType: body.transactionType,
        qty: parseFloat(body.qty),
        unitCost: body.unitCost,
        notes: body.notes,
      },
    );
    return res.status(201).json({ data: item });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

// ─── Work Order Parts ──────────────────────────────────────────────────────────

router.get("/work-orders/:id/parts", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await maintenanceService.listWorkOrderParts(String(req.params.id));
    return res.json({ data: items });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.post("/work-orders/:id/parts", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.partId || body.qtyUsed == null) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "partId, qtyUsed required" } });
    }
    const item = await maintenanceService.addPartToWorkOrder(
      String(req.params.id),
      req.tenant!.companyId,
      req.user!.userId,
      { partId: body.partId, qtyUsed: parseFloat(body.qtyUsed), unitCost: body.unitCost },
    );
    return res.status(201).json({ data: item });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

router.delete("/work-orders/:id/parts/:partId", authenticate, requireCompanyAccess, requirePermission("asset:update"), async (req, res) => {
  try {
    await maintenanceService.removePartFromWorkOrder(
      String(req.params.partId),
      String(req.params.id),
      req.tenant!.companyId,
      req.user!.userId,
    );
    return res.status(204).send();
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err?.message } });
  }
});

// ─── Work Orders detail ────────────────────────────────────────────────────────

router.get("/work-orders/:id", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const item = await serviceService.getWorkOrder(String(req.params.id), req.tenant!.companyId);
    if (!item) return res.status(404).json({ error: "Not found" });
    const parts = await maintenanceService.listWorkOrderParts(String(req.params.id));
    return res.json({ data: { ...item, parts } });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

// ─── Service Analytics ─────────────────────────────────────────────────────────

router.get("/service-stats", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const stats = await maintenanceService.getServiceStats(req.tenant!.companyId);
    return res.json({ data: stats });
  } catch (err: any) {
    logger.error({ err }, "GET /service-stats error");
    return res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

export default router;
