import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as batteryService from "../services/battery.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const createBatterySchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  serialNumber: z.string().min(1).max(255),
  model: z.string().max(255).optional(),
  capacityWh: z.number().int().optional(),
  healthPercent: z.number().int().min(0).max(100).optional(),
  cycleCount: z.number().int().optional(),
  currentChargePercent: z.number().int().min(0).max(100).optional(),
  currentVoltage: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateBatterySchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  stationId: z.string().uuid().nullable().optional(),
  model: z.string().max(255).nullable().optional(),
  capacityWh: z.number().int().nullable().optional(),
  healthPercent: z.number().int().min(0).max(100).nullable().optional(),
  cycleCount: z.number().int().nullable().optional(),
  currentChargePercent: z.number().int().min(0).max(100).nullable().optional(),
  currentVoltage: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const assignSchema = z.object({
  batteryId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

router.post(
  "/batteries",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:create"),
  validate({ body: createBatterySchema }),
  async (req, res) => {
    const battery = await batteryService.createBattery(
      req.tenant!.companyId,
      req.body,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "battery",
      entityId: battery.id,
      req,
    });
    res.status(201).json({ data: battery });
  },
);

router.get(
  "/batteries",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:read"),
  async (req, res) => {
    const { status, branchId } = req.query as Record<string, string>;
    const list = await batteryService.listBatteries(req.tenant!.companyId, {
      status,
      branchId,
    });
    res.json({ data: list });
  },
);

router.get(
  "/batteries/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const battery = await batteryService.getBattery(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: battery });
  },
);

router.patch(
  "/batteries/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:update"),
  validate({ params: idParams, body: updateBatterySchema }),
  async (req, res) => {
    const battery = await batteryService.updateBattery(
      req.params.id as string,
      req.tenant!.companyId,
      req.body,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "battery",
      entityId: battery.id,
      req,
    });
    res.json({ data: battery });
  },
);

router.post(
  "/batteries/:id/archive",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const battery = await batteryService.archiveBattery(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "archive",
      entityType: "battery",
      entityId: battery.id,
      req,
    });
    res.json({ data: battery });
  },
);

router.post(
  "/assets/:id/batteries/assign",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:update"),
  validate({ params: idParams, body: assignSchema }),
  async (req, res) => {
    const assignment = await batteryService.assignBattery(
      req.tenant!.companyId,
      req.params.id as string,
      {
        batteryId: req.body.batteryId,
        userId: req.user!.userId,
        notes: req.body.notes,
      },
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "assign_battery",
      entityType: "battery_assignment",
      entityId: assignment.id,
      req,
    });
    res.status(201).json({ data: assignment });
  },
);

router.post(
  "/assets/:id/batteries/remove",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const assignment = await batteryService.removeBattery(
      req.tenant!.companyId,
      req.params.id as string,
      { userId: req.user!.userId },
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "remove_battery",
      entityType: "battery_assignment",
      entityId: assignment.id,
      req,
    });
    res.json({ data: assignment });
  },
);

router.get(
  "/assets/:id/batteries",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const assignments = await batteryService.getAssetBatteries(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: assignments });
  },
);

router.get(
  "/batteries/:id/events",
  authenticate,
  requireCompanyAccess,
  requirePermission("battery:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const events = await batteryService.getBatteryEvents(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: events });
  },
);

export default router;
