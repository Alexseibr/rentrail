import { Router } from "express";
import { validate } from "../middlewares/validate";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as serviceService from "../services/service.service";
import * as maintenanceService from "../services/maintenance.service";
import { logger } from "../lib/logger";
import { maintenanceLogTypeEnum } from "@workspace/db/schema";
import { AppError } from "../lib/errors";

const router = Router();

function toHttpError(err: unknown): {
  status: number;
  code: string;
  message: string | undefined;
} {
  const appErr = err instanceof AppError ? err : null;
  return {
    status: appErr?.statusCode ?? 500,
    code: appErr?.code ?? "INTERNAL",
    message: err instanceof Error ? err.message : undefined,
  };
}

const VALID_SERVICE_REQUEST_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "on_hold",
  "completed",
  "canceled",
] as const;

router.get(
  "/service-requests",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const statusParam = req.query.status as string | undefined;
      if (
        statusParam &&
        !VALID_SERVICE_REQUEST_STATUSES.includes(
          statusParam as (typeof VALID_SERVICE_REQUEST_STATUSES)[number],
        )
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: `Invalid status value: ${statusParam}`,
          },
        });
      }
      const items = await serviceService.listServiceRequests(
        req.tenant!.companyId,
        req.query.branchId as string | undefined,
        statusParam,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      logger.error({ err }, "GET /service-requests error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.get(
  "/service-requests/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    const item = await serviceService.getServiceRequest(
      req.params.id as string,
      req.tenant!.companyId,
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ data: item });
  },
);

const createServiceRequestSchema = z.object({
  branchId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  requestType: z.string().optional(),
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  locationAddress: z.string().optional(),
});

const updateServiceRequestSchema = z.object({
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  locationAddress: z.string().optional(),
  assignedToUserId: z.string().uuid().optional(),
  status: z.string().optional(),
  resolution: z.string().optional(),
});

router.post(
  "/service-requests",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createServiceRequestSchema }),
  async (req, res) => {
    const {
      branchId,
      assetId,
      clientId,
      requestType,
      priority,
      title,
      description,
      lat,
      lng,
      locationAddress,
    } = req.body as z.infer<typeof createServiceRequestSchema>;
    const item = await serviceService.createServiceRequest({
      companyId: req.tenant!.companyId,
      branchId: branchId as string,
      assetId: assetId as string,
      clientId: clientId as string,
      requestType: requestType as string,
      priority: priority as string,
      title: title as string,
      description,
      reportedByUserId: req.user!.userId,
      lat,
      lng,
      locationAddress,
    });
    return res.status(201).json({ data: item });
  },
);

const ALLOWED_SR_PATCH_FIELDS = [
  "priority",
  "title",
  "description",
  "locationAddress",
] as const;

router.patch(
  "/service-requests/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateServiceRequestSchema }),
  async (req, res) => {
    const body = req.body as z.infer<typeof updateServiceRequestSchema>;
    const safeData: Record<string, unknown> = {};
    for (const key of ALLOWED_SR_PATCH_FIELDS) {
      if (body[key] !== undefined) safeData[key] = body[key];
    }
    if (Object.keys(safeData).length === 0)
      return res.status(400).json({ error: "No valid fields to update" });
    const item = await serviceService.updateServiceRequest(
      req.params.id as string,
      req.tenant!.companyId,
      safeData,
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ data: item });
  },
);

router.post(
  "/service-requests/:id/assign",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateServiceRequestSchema }),
  async (req, res) => {
    const { assignedToUserId } = req.body as z.infer<
      typeof updateServiceRequestSchema
    >;
    const item = await serviceService.updateServiceRequest(
      req.params.id as string,
      req.tenant!.companyId,
      {
        assignedToUserId,
        status: "assigned",
      },
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ data: item });
  },
);

router.post(
  "/service-requests/:id/status",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateServiceRequestSchema }),
  async (req, res) => {
    const { status } = req.body as z.infer<typeof updateServiceRequestSchema>;
    const update: Record<string, unknown> = { status };
    if (status === "completed") update.resolvedAt = new Date();
    const item = await serviceService.updateServiceRequest(
      req.params.id as string,
      req.tenant!.companyId,
      update,
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ data: item });
  },
);

const VALID_WORK_ORDER_STATUSES = [
  "draft",
  "assigned",
  "en_route",
  "in_progress",
  "waiting_parts",
  "completed",
  "canceled",
] as const;

router.get(
  "/work-orders",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const statusParam = req.query.status as string | undefined;
      if (
        statusParam &&
        !VALID_WORK_ORDER_STATUSES.includes(
          statusParam as (typeof VALID_WORK_ORDER_STATUSES)[number],
        )
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: `Invalid status value: ${statusParam}`,
          },
        });
      }
      const items = await serviceService.listWorkOrders(
        req.tenant!.companyId,
        req.query.branchId as string | undefined,
        statusParam,
        req.query.assignedToUserId as string | undefined,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      logger.error({ err }, "GET /work-orders error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

const createWorkOrderSchema = z.object({
  branchId: z.string().uuid().optional(),
  serviceRequestId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  orderType: z.string().optional(),
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  assignedToUserId: z.string().uuid().optional(),
  estimatedCost: z.string().optional(),
});

const updateWorkOrderSchema = z.object({
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  estimatedCost: z.string().optional(),
  status: z.string().optional(),
  resolution: z.string().optional(),
  actualCost: z.string().optional(),
  partsUsed: z.unknown().optional(),
});

router.post(
  "/work-orders",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createWorkOrderSchema }),
  async (req, res) => {
    try {
      const {
        branchId,
        serviceRequestId,
        assetId,
        orderType,
        priority,
        title,
        description,
        assignedToUserId,
        estimatedCost,
      } = req.body as z.infer<typeof createWorkOrderSchema>;
      if (!title || !orderType) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: "title, orderType required" },
        });
      }
      const item = await serviceService.createWorkOrder({
        companyId: req.tenant!.companyId,
        branchId,
        serviceRequestId,
        assetId,
        orderType,
        priority,
        title,
        description,
        assignedToUserId,
        createdByUserId: req.user!.userId,
        estimatedCost,
      });
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      logger.error({ err }, "POST /work-orders error");
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code ?? "INTERNAL_ERROR", message: e.message },
      });
    }
  },
);

const ALLOWED_WO_PATCH_FIELDS = [
  "priority",
  "title",
  "description",
  "estimatedCost",
] as const;

router.patch(
  "/work-orders/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateWorkOrderSchema }),
  async (req, res) => {
    const body = req.body as z.infer<typeof updateWorkOrderSchema>;
    const safeData: Record<string, unknown> = {};
    for (const key of ALLOWED_WO_PATCH_FIELDS) {
      if (body[key] !== undefined) safeData[key] = body[key];
    }
    if (Object.keys(safeData).length === 0)
      return res.status(400).json({ error: "No valid fields to update" });
    const item = await serviceService.updateWorkOrder(
      req.params.id as string,
      req.tenant!.companyId,
      safeData,
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ data: item });
  },
);

router.post(
  "/work-orders/:id/status",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateWorkOrderSchema }),
  async (req, res) => {
    const { status, resolution, actualCost, partsUsed } = req.body as z.infer<
      typeof updateWorkOrderSchema
    >;
    const update: Record<string, unknown> = { status };
    if (status === "in_progress") update.startedAt = new Date();
    if (status === "completed") {
      update.completedAt = new Date();
      if (resolution) update.resolution = resolution;
      if (actualCost) update.actualCost = actualCost;
      if (partsUsed) update.partsUsed = partsUsed;
    }
    const item = await serviceService.updateWorkOrder(
      req.params.id as string,
      req.tenant!.companyId,
      update,
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ data: item });
  },
);

router.get(
  "/mechanics",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const items = await serviceService.getMechanics(
        req.tenant!.companyId,
        req.query.branchId as string | undefined,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      logger.error({ err }, "GET /mechanics error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.get(
  "/fleet-map",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
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

      interface TelemetrySnapRow {
        assetId: string;
        lat: number | null;
        lng: number | null;
        batteryPercent: number | null;
        speed: number | null;
        lockState: string | null;
        recordedAt: Date | null;
      }
      const snapRows: TelemetrySnapRow[] = Array.isArray(latestResult)
        ? (latestResult as unknown as TelemetrySnapRow[])
        : (((latestResult as { rows: unknown[] }).rows ??
            []) as TelemetrySnapRow[]);
      const latestByAsset = new Map<string, TelemetrySnapRow>();
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
    } catch (err: unknown) {
      logger.error({ err }, "GET /fleet-map error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

// ─── Maintenance Logs ──────────────────────────────────────────────────────────

const VALID_MAINTENANCE_LOG_TYPES = maintenanceLogTypeEnum.enumValues;

router.get(
  "/maintenance-logs",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const logTypeParam = req.query.logType as string | undefined;
      if (
        logTypeParam &&
        !VALID_MAINTENANCE_LOG_TYPES.includes(
          logTypeParam as (typeof VALID_MAINTENANCE_LOG_TYPES)[number],
        )
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: `Invalid logType value: ${logTypeParam}`,
          },
        });
      }
      const items = await maintenanceService.listMaintenanceLogs(
        req.tenant!.companyId,
        req.query.assetId as string | undefined,
        req.query.limit ? parseInt(req.query.limit as string) : 50,
        logTypeParam,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      logger.error({ err }, "GET /maintenance-logs error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

const createMaintenanceLogSchema = z.object({
  assetId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  logType: z.string().optional(),
  performedAt: z.string().optional(),
  performedByUserId: z.string().uuid().optional(),
  odometerKm: z.number().optional(),
  cost: z.number().optional(),
  partsUsed: z.string().optional(),
  notes: z.string().optional(),
  nextServiceKm: z.number().optional(),
  nextServiceDate: z.string().optional(),
});

router.post(
  "/maintenance-logs",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createMaintenanceLogSchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof createMaintenanceLogSchema>;
      if (!body.assetId || !body.logType) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: "assetId, logType required" },
        });
      }
      const item = await maintenanceService.createMaintenanceLog(
        req.tenant!.companyId,
        {
          assetId: body.assetId,
          branchId: body.branchId,
          workOrderId: body.workOrderId,
          logType: body.logType,
          performedAt: body.performedAt
            ? new Date(body.performedAt)
            : new Date(),
          performedByUserId: body.performedByUserId ?? req.user!.userId,
          odometerKm: body.odometerKm,
          cost: body.cost,
          partsUsed: body.partsUsed,
          notes: body.notes,
          nextServiceKm: body.nextServiceKm,
          nextServiceDate: body.nextServiceDate
            ? new Date(body.nextServiceDate)
            : undefined,
        },
      );
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      logger.error({ err }, "POST /maintenance-logs error");
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

router.get(
  "/maintenance-logs/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const item = await maintenanceService.getMaintenanceLog(
        req.params.id as string,
        req.tenant!.companyId,
      );
      if (!item)
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Maintenance log not found" },
        });
      return res.json({ data: item });
    } catch (err: unknown) {
      logger.error({ err }, "GET /maintenance-logs/:id error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

const updateMaintenanceLogSchema = z.object({
  notes: z.string().optional(),
  cost: z.union([z.string(), z.number()]).optional(),
  odometerKm: z.union([z.string(), z.number()]).optional(),
});

router.patch(
  "/maintenance-logs/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateMaintenanceLogSchema }),
  async (req, res) => {
    try {
      const { notes, cost, odometerKm } = req.body as z.infer<
        typeof updateMaintenanceLogSchema
      >;
      const hasFields =
        notes !== undefined || cost !== undefined || odometerKm !== undefined;
      if (!hasFields) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: "No valid fields to update" },
        });
      }
      const row = await maintenanceService.updateMaintenanceLog(
        req.params.id as string,
        req.tenant!.companyId,
        {
          notes: notes !== undefined ? String(notes) : undefined,
          cost: cost !== undefined ? String(cost) : undefined,
          odometerKm: odometerKm !== undefined ? String(odometerKm) : undefined,
        },
      );
      if (!row)
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Maintenance log not found" },
        });
      return res.json({ data: row });
    } catch (err: unknown) {
      logger.error({ err }, "PATCH /maintenance-logs/:id error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

// ─── Maintenance Schedules ─────────────────────────────────────────────────────

router.get(
  "/maintenance-schedules",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const items = await maintenanceService.listMaintenanceSchedules(
        req.tenant!.companyId,
        req.query.assetId as string | undefined,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.get(
  "/maintenance-schedules/overdue",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const items = await maintenanceService.getOverdueSchedules(
        req.tenant!.companyId,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

const createMaintenanceScheduleSchema = z.object({
  assetId: z.string().uuid().optional(),
  assetType: z.string().optional(),
  scheduleType: z.string().optional(),
  name: z.string().optional(),
  intervalKm: z.number().optional(),
  intervalDays: z.number().optional(),
  lastDoneKm: z.number().optional(),
  lastDoneAt: z.string().optional(),
});

const updateMaintenanceScheduleSchema = z.object({
  name: z.string().optional(),
  intervalKm: z.number().optional(),
  intervalDays: z.number().optional(),
  nextDueKm: z.number().optional(),
  nextDueAt: z.string().optional(),
  enabled: z.boolean().optional(),
});

router.post(
  "/maintenance-schedules",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createMaintenanceScheduleSchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof createMaintenanceScheduleSchema>;
      if (!body.scheduleType || !body.name) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: "scheduleType, name required",
          },
        });
      }
      const item = await maintenanceService.createMaintenanceSchedule(
        req.tenant!.companyId,
        {
          assetId: body.assetId,
          assetType: body.assetType,
          scheduleType: body.scheduleType,
          name: body.name,
          intervalKm: body.intervalKm,
          intervalDays: body.intervalDays,
          lastDoneKm: body.lastDoneKm,
          lastDoneAt: body.lastDoneAt ? new Date(body.lastDoneAt) : undefined,
        },
      );
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.patch(
  "/maintenance-schedules/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateMaintenanceScheduleSchema }),
  async (req, res) => {
    try {
      const ALLOWED = [
        "name",
        "intervalKm",
        "intervalDays",
        "nextDueKm",
        "nextDueAt",
        "enabled",
      ] as const;
      const body = req.body as z.infer<typeof updateMaintenanceScheduleSchema>;
      const safe: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (body[k] !== undefined) safe[k] = body[k];
      }
      const item = await maintenanceService.updateMaintenanceSchedule(
        String(req.params.id),
        req.tenant!.companyId,
        safe,
      );
      return res.json({ data: item });
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

router.delete(
  "/maintenance-schedules/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  async (req, res) => {
    try {
      await maintenanceService.deleteMaintenanceSchedule(
        String(req.params.id),
        req.tenant!.companyId,
      );
      return res.status(204).send();
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

// ─── Spare Parts ───────────────────────────────────────────────────────────────

router.get(
  "/spare-parts",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const items = await maintenanceService.listSpareParts(
        req.tenant!.companyId,
        req.query.branchId as string | undefined,
        req.query.lowStock === "true",
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.get(
  "/spare-parts/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const item = await maintenanceService.getSparePart(
        String(req.params.id),
        req.tenant!.companyId,
      );
      return res.json({ data: item });
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

const createSparePartSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  qtyInStock: z.number().optional(),
  minQtyAlert: z.number().optional(),
  costPrice: z.number().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateSparePartSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  minQtyAlert: z.number().optional(),
  costPrice: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const createSparePartTransactionSchema = z.object({
  partId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  transactionType: z.string().optional(),
  qty: z.union([z.string(), z.number()]).optional(),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
});

const addWorkOrderPartSchema = z.object({
  partId: z.string().uuid().optional(),
  qtyUsed: z.union([z.string(), z.number()]).optional(),
  unitCost: z.number().optional(),
});

router.post(
  "/spare-parts",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createSparePartSchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof createSparePartSchema>;
      if (!body.name || !body.category) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: "name, category required" },
        });
      }
      const item = await maintenanceService.createSparePart(
        req.tenant!.companyId,
        {
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
        },
      );
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.patch(
  "/spare-parts/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: updateSparePartSchema }),
  async (req, res) => {
    try {
      const ALLOWED = [
        "name",
        "sku",
        "category",
        "unit",
        "minQtyAlert",
        "costPrice",
        "location",
        "notes",
      ] as const;
      const body = req.body as z.infer<typeof updateSparePartSchema>;
      const safe: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (body[k] !== undefined) safe[k] = body[k];
      }
      const item = await maintenanceService.updateSparePart(
        String(req.params.id),
        req.tenant!.companyId,
        safe,
      );
      return res.json({ data: item });
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

router.delete(
  "/spare-parts/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  async (req, res) => {
    try {
      await maintenanceService.deleteSparePart(
        String(req.params.id),
        req.tenant!.companyId,
      );
      return res.status(204).send();
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

router.get(
  "/spare-parts/:id/transactions",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const items = await maintenanceService.listSparePartTransactions(
        req.tenant!.companyId,
        String(req.params.id),
        req.query.limit ? parseInt(req.query.limit as string) : 100,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.post(
  "/spare-parts/transactions",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createSparePartTransactionSchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof createSparePartTransactionSchema>;
      if (!body.partId || !body.transactionType || body.qty == null) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: "partId, transactionType, qty required",
          },
        });
      }
      const item = await maintenanceService.createSparePartTransaction(
        req.tenant!.companyId,
        req.user!.userId,
        {
          partId: body.partId,
          workOrderId: body.workOrderId,
          transactionType: body.transactionType,
          qty: parseFloat(String(body.qty)),
          unitCost: body.unitCost,
          notes: body.notes,
        },
      );
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

// ─── Work Order Parts ──────────────────────────────────────────────────────────

router.get(
  "/work-orders/:id/parts",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const items = await maintenanceService.listWorkOrderParts(
        String(req.params.id),
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

router.post(
  "/work-orders/:id/parts",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: addWorkOrderPartSchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof addWorkOrderPartSchema>;
      if (!body.partId || body.qtyUsed == null) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: "partId, qtyUsed required" },
        });
      }
      const item = await maintenanceService.addPartToWorkOrder(
        String(req.params.id),
        req.tenant!.companyId,
        req.user!.userId,
        {
          partId: body.partId,
          qtyUsed: parseFloat(String(body.qtyUsed)),
          unitCost: body.unitCost,
        },
      );
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

router.delete(
  "/work-orders/:id/parts/:partId",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  async (req, res) => {
    try {
      await maintenanceService.removePartFromWorkOrder(
        String(req.params.partId),
        String(req.params.id),
        req.tenant!.companyId,
        req.user!.userId,
      );
      return res.status(204).send();
    } catch (err: unknown) {
      const e = toHttpError(err);
      return res.status(e.status).json({
        error: { code: e.code, message: e.message },
      });
    }
  },
);

// ─── Work Orders detail ────────────────────────────────────────────────────────

router.get(
  "/work-orders/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const item = await serviceService.getWorkOrder(
        String(req.params.id),
        req.tenant!.companyId,
      );
      if (!item) return res.status(404).json({ error: "Not found" });
      const parts = await maintenanceService.listWorkOrderParts(
        String(req.params.id),
      );
      return res.json({ data: { ...item, parts } });
    } catch (err: unknown) {
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

// ─── Service Analytics ─────────────────────────────────────────────────────────

router.get(
  "/service-stats",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const stats = await maintenanceService.getServiceStats(
        req.tenant!.companyId,
      );
      return res.json({ data: stats });
    } catch (err: unknown) {
      logger.error({ err }, "GET /service-stats error");
      return res.status(500).json({
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : undefined,
        },
      });
    }
  },
);

export default router;
