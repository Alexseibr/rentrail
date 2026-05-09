import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as geofenceService from "../services/geofence.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const createGeofenceSchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  type: z.enum([
    "operating_zone",
    "no_ride_zone",
    "return_zone",
    "service_zone",
    "charging_zone",
  ]),
  geometry: z.object({ type: z.string(), coordinates: z.array(z.unknown()) }),
  rules: z.record(z.string(), z.unknown()).optional(),
});

const updateGeofenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z
    .enum([
      "operating_zone",
      "no_ride_zone",
      "return_zone",
      "service_zone",
      "charging_zone",
    ])
    .optional(),
  geometry: z
    .object({ type: z.string(), coordinates: z.array(z.unknown()) })
    .optional(),
  rules: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().optional(),
});

router.post(
  "/geofences",
  authenticate,
  requireCompanyAccess,
  requirePermission("geofence:create"),
  validate({ body: createGeofenceSchema }),
  async (req, res) => {
    const geo = await geofenceService.createGeofence(
      req.tenant!.companyId,
      req.body as z.infer<typeof createGeofenceSchema>,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "geofence",
      entityId: geo.id,
      req,
    });
    res.status(201).json({ data: geo });
  },
);

router.get(
  "/geofences",
  authenticate,
  requireCompanyAccess,
  requirePermission("geofence:read"),
  async (req, res) => {
    const { type, branchId, isActive } = req.query as Record<string, string>;
    const list = await geofenceService.listGeofences(req.tenant!.companyId, {
      type,
      branchId,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
    res.json({ data: list });
  },
);

router.get(
  "/geofences/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("geofence:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const geo = await geofenceService.getGeofence(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: geo });
  },
);

router.patch(
  "/geofences/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("geofence:update"),
  validate({ params: idParams, body: updateGeofenceSchema }),
  async (req, res) => {
    const geo = await geofenceService.updateGeofence(
      req.params.id as string,
      req.tenant!.companyId,
      req.body as z.infer<typeof updateGeofenceSchema>,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "geofence",
      entityId: geo.id,
      req,
    });
    res.json({ data: geo });
  },
);

router.post(
  "/geofences/:id/archive",
  authenticate,
  requireCompanyAccess,
  requirePermission("geofence:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const geo = await geofenceService.archiveGeofence(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "archive",
      entityType: "geofence",
      entityId: geo.id,
      req,
    });
    res.json({ data: geo });
  },
);

export default router;
