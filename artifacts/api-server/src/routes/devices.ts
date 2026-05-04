import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as deviceService from "../services/device.service";
import { createAuditLog } from "../lib/audit";
import { deviceStatusEnum, deviceTypeEnum } from "@workspace/db/schema";

const router: IRouter = Router();

const VALID_DEVICE_STATUSES = deviceStatusEnum.enumValues;
const VALID_DEVICE_TYPES = deviceTypeEnum.enumValues;

const idParams = z.object({ id: z.string().uuid() });

const createDeviceSchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  deviceType: z.enum(["gps_tracker", "smart_lock", "battery_bms", "controller", "iot_gateway", "other"]),
  provider: z.string().min(1).max(100),
  externalId: z.string().min(1).max(255),
  serialNumber: z.string().max(255).optional(),
  imei: z.string().max(20).optional(),
  simNumber: z.string().max(50).optional(),
  firmwareVersion: z.string().max(100).optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateDeviceSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  stationId: z.string().uuid().nullable().optional(),
  serialNumber: z.string().max(255).nullable().optional(),
  imei: z.string().max(20).nullable().optional(),
  simNumber: z.string().max(50).nullable().optional(),
  firmwareVersion: z.string().max(100).nullable().optional(),
  capabilities: z.array(z.string()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const changeStatusSchema = z.object({
  status: z.enum(["draft", "active", "inactive", "offline", "maintenance", "blocked", "retired"]),
});

router.post("/devices", authenticate, requireCompanyAccess, requirePermission("device:create"),
  validate({ body: createDeviceSchema }), async (req, res) => {
    const device = await deviceService.createDevice(req.tenant!.companyId, req.body);
    await createAuditLog({ companyId: req.tenant!.companyId, actorUserId: req.user!.userId, action: "create", entityType: "device", entityId: device.id, req });
    res.status(201).json({ data: device });
  });

router.get("/devices", authenticate, requireCompanyAccess, requirePermission("device:read"), async (req, res) => {
  const { status, deviceType, branchId, provider } = req.query as Record<string, string>;
  if (status && !VALID_DEVICE_STATUSES.includes(status as (typeof VALID_DEVICE_STATUSES)[number])) {
    return res.status(400).json({ error: { code: "VALIDATION", message: `Invalid status value: ${status}` } });
  }
  if (deviceType && !VALID_DEVICE_TYPES.includes(deviceType as (typeof VALID_DEVICE_TYPES)[number])) {
    return res.status(400).json({ error: { code: "VALIDATION", message: `Invalid deviceType value: ${deviceType}` } });
  }
  const list = await deviceService.listDevices(req.tenant!.companyId, { status, deviceType, branchId, provider });
  return res.json({ data: list });
});

router.get("/devices/:id", authenticate, requireCompanyAccess, requirePermission("device:read"),
  validate({ params: idParams }), async (req, res) => {
    const device = await deviceService.getDevice(req.params.id as string, req.tenant!.companyId);
    res.json({ data: device });
  });

router.patch("/devices/:id", authenticate, requireCompanyAccess, requirePermission("device:update"),
  validate({ params: idParams, body: updateDeviceSchema }), async (req, res) => {
    const device = await deviceService.updateDevice(req.params.id as string, req.tenant!.companyId, req.body);
    await createAuditLog({ companyId: req.tenant!.companyId, actorUserId: req.user!.userId, action: "update", entityType: "device", entityId: device.id, req });
    res.json({ data: device });
  });

router.post("/devices/:id/change-status", authenticate, requireCompanyAccess, requirePermission("device:changeStatus"),
  validate({ params: idParams, body: changeStatusSchema }), async (req, res) => {
    const device = await deviceService.changeDeviceStatus(req.params.id as string, req.tenant!.companyId, req.body.status);
    await createAuditLog({ companyId: req.tenant!.companyId, actorUserId: req.user!.userId, action: "change_status", entityType: "device", entityId: device.id, after: { status: device.status }, req });
    res.json({ data: device });
  });

router.post("/devices/:id/archive", authenticate, requireCompanyAccess, requirePermission("device:update"),
  validate({ params: idParams }), async (req, res) => {
    const device = await deviceService.archiveDevice(req.params.id as string, req.tenant!.companyId);
    await createAuditLog({ companyId: req.tenant!.companyId, actorUserId: req.user!.userId, action: "archive", entityType: "device", entityId: device.id, req });
    res.json({ data: device });
  });

router.post("/devices/:id/restore", authenticate, requireCompanyAccess, requirePermission("device:update"),
  validate({ params: idParams }), async (req, res) => {
    const device = await deviceService.restoreDevice(req.params.id as string, req.tenant!.companyId);
    await createAuditLog({ companyId: req.tenant!.companyId, actorUserId: req.user!.userId, action: "restore", entityType: "device", entityId: device.id, req });
    res.json({ data: device });
  });

export default router;
