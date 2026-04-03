import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as serviceService from "../services/service.service";
import { logger } from "../lib/logger";

const router = Router();

router.get("/service-requests", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await serviceService.listServiceRequests(
      req.tenant!.companyId,
      req.query.branchId as string | undefined,
      req.query.status as string | undefined
    );
    res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /service-requests error");
    res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.get("/service-requests/:id", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  const item = await serviceService.getServiceRequest(req.params.id, req.tenant!.companyId);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
});

router.post("/service-requests", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
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
  res.status(201).json({ data: item });
});

const ALLOWED_SR_PATCH_FIELDS = ["priority", "title", "description", "locationAddress"] as const;

router.patch("/service-requests/:id", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
  const safeData: Record<string, unknown> = {};
  for (const key of ALLOWED_SR_PATCH_FIELDS) {
    if (req.body[key] !== undefined) safeData[key] = req.body[key];
  }
  if (Object.keys(safeData).length === 0) return res.status(400).json({ error: "No valid fields to update" });
  const item = await serviceService.updateServiceRequest(req.params.id, req.tenant!.companyId, safeData);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
});

router.post("/service-requests/:id/assign", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
  const item = await serviceService.updateServiceRequest(req.params.id, req.tenant!.companyId, {
    assignedToUserId: req.body.assignedToUserId,
    status: "assigned",
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
});

router.post("/service-requests/:id/status", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
  const update: Record<string, unknown> = { status: req.body.status };
  if (req.body.status === "completed") update.resolvedAt = new Date();
  const item = await serviceService.updateServiceRequest(req.params.id, req.tenant!.companyId, update);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
});

router.get("/work-orders", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await serviceService.listWorkOrders(
      req.tenant!.companyId,
      req.query.branchId as string | undefined,
      req.query.status as string | undefined
    );
    res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /work-orders error");
    res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.post("/work-orders", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
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
  res.status(201).json({ data: item });
});

const ALLOWED_WO_PATCH_FIELDS = ["priority", "title", "description", "estimatedCost"] as const;

router.patch("/work-orders/:id", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
  const safeData: Record<string, unknown> = {};
  for (const key of ALLOWED_WO_PATCH_FIELDS) {
    if (req.body[key] !== undefined) safeData[key] = req.body[key];
  }
  if (Object.keys(safeData).length === 0) return res.status(400).json({ error: "No valid fields to update" });
  const item = await serviceService.updateWorkOrder(req.params.id, req.tenant!.companyId, safeData);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
});

router.post("/work-orders/:id/status", authenticate, requireCompanyAccess, requirePermission("asset:write"), async (req, res) => {
  const update: Record<string, unknown> = { status: req.body.status };
  if (req.body.status === "in_progress") update.startedAt = new Date();
  if (req.body.status === "completed") {
    update.completedAt = new Date();
    if (req.body.resolution) update.resolution = req.body.resolution;
    if (req.body.actualCost) update.actualCost = req.body.actualCost;
    if (req.body.partsUsed) update.partsUsed = req.body.partsUsed;
  }
  const item = await serviceService.updateWorkOrder(req.params.id, req.tenant!.companyId, update);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
});

router.get("/mechanics", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const items = await serviceService.getMechanics(
      req.tenant!.companyId,
      req.query.branchId as string | undefined
    );
    res.json({ data: items });
  } catch (err: any) {
    logger.error({ err }, "GET /mechanics error");
    res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

router.get("/fleet-map", authenticate, requireCompanyAccess, requirePermission("asset:read"), async (req, res) => {
  try {
    const { db: dbImport } = await import("@workspace/db");
    const { assets: assetsTable, telemetrySnapshots } = await import("@workspace/db/schema");
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

    res.json({ data: result });
  } catch (err: any) {
    logger.error({ err }, "GET /fleet-map error");
    res.status(500).json({ error: { code: "INTERNAL", message: err?.message } });
  }
});

export default router;
