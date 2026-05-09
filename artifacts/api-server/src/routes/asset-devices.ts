import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as adService from "../services/asset-device.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const assetParams = z.object({ id: z.string().uuid() });
const bindingParams = z.object({
  id: z.string().uuid(),
  bindingId: z.string().uuid(),
});

const bindSchema = z.object({
  deviceId: z.string().uuid(),
  bindingType: z.enum([
    "tracker",
    "lock",
    "battery_bms",
    "controller",
    "gateway",
    "other",
  ]),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

router.post(
  "/assets/:id/devices",
  authenticate,
  requireCompanyAccess,
  requirePermission("device:update"),
  validate({ params: assetParams, body: bindSchema }),
  async (req, res) => {
    const binding = await adService.bindDeviceToAsset(
      req.tenant!.companyId,
      req.params.id as string,
      // type-coverage:ignore-next-line
      req.body as z.infer<typeof bindSchema>,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "bind_device",
      entityType: "asset_device",
      entityId: binding.id,
      req,
    });
    res.status(201).json({ data: binding });
  },
);

router.get(
  "/assets/:id/devices",
  authenticate,
  requireCompanyAccess,
  requirePermission("device:read"),
  validate({ params: assetParams }),
  async (req, res) => {
    const bindings = await adService.getCurrentActiveDevicesForAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: bindings });
  },
);

router.post(
  "/assets/:id/devices/:bindingId/remove",
  authenticate,
  requireCompanyAccess,
  requirePermission("device:update"),
  validate({ params: bindingParams }),
  async (req, res) => {
    const binding = await adService.removeBinding(
      req.params.id as string,
      req.params.bindingId as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "remove_binding",
      entityType: "asset_device",
      entityId: binding.id,
      req,
    });
    res.json({ data: binding });
  },
);

router.post(
  "/assets/:id/devices/:bindingId/set-primary",
  authenticate,
  requireCompanyAccess,
  requirePermission("device:update"),
  validate({ params: bindingParams }),
  async (req, res) => {
    const binding = await adService.setPrimaryBinding(
      req.params.id as string,
      req.params.bindingId as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "set_primary",
      entityType: "asset_device",
      entityId: binding.id,
      req,
    });
    res.json({ data: binding });
  },
);

export default router;
