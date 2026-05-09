import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as commandService from "../services/command.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const deviceIdParams = z.object({ id: z.string().uuid() });
const cmdIdParams = z.object({ id: z.string().uuid() });

const enqueueSchema = z.object({
  commandType: z.enum([
    "lock",
    "unlock",
    "arm_alarm",
    "disarm_alarm",
    "locate",
    "ping",
    "disable",
    "set_speed_limit",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
  assetId: z.string().uuid().optional(),
  expiresInMinutes: z.number().int().min(1).max(1440).optional(),
});

router.post(
  "/devices/:id/commands",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:create"),
  validate({ params: deviceIdParams, body: enqueueSchema }),
  async (req, res) => {
    const cmd = await commandService.enqueueCommand(
      req.tenant!.companyId,
      req.params.id as string,
      {
        ...(req.body as z.infer<typeof enqueueSchema>),
        requestedByUserId: req.user!.userId,
      },
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "enqueue_command",
      entityType: "device_command",
      entityId: cmd.id,
      req,
    });
    res.status(201).json({ data: cmd });
  },
);

router.get(
  "/devices/:id/commands",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:read"),
  validate({ params: deviceIdParams }),
  async (req, res) => {
    const cmds = await commandService.listDeviceCommands(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: cmds });
  },
);

router.get(
  "/commands/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:read"),
  validate({ params: cmdIdParams }),
  async (req, res) => {
    const cmd = await commandService.getCommand(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: cmd });
  },
);

const assetIdParams = z.object({ id: z.string().uuid() });

router.get(
  "/assets/:id/commands",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:read"),
  validate({ params: assetIdParams }),
  async (req, res) => {
    const cmds = await commandService.listAssetCommands(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: cmds });
  },
);

router.post(
  "/assets/:id/lock",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:create"),
  validate({ params: assetIdParams }),
  async (req, res) => {
    const cmd = await commandService.enqueueAssetCommand(
      req.tenant!.companyId,
      req.params.id as string,
      "lock",
      req.user!.userId,
    );
    res.status(201).json({ data: cmd });
  },
);

router.post(
  "/assets/:id/unlock",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:create"),
  validate({ params: assetIdParams }),
  async (req, res) => {
    const cmd = await commandService.enqueueAssetCommand(
      req.tenant!.companyId,
      req.params.id as string,
      "unlock",
      req.user!.userId,
    );
    res.status(201).json({ data: cmd });
  },
);

router.post(
  "/assets/:id/alarm/arm",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:create"),
  validate({ params: assetIdParams }),
  async (req, res) => {
    const cmd = await commandService.enqueueAssetCommand(
      req.tenant!.companyId,
      req.params.id as string,
      "arm_alarm",
      req.user!.userId,
    );
    res.status(201).json({ data: cmd });
  },
);

router.post(
  "/assets/:id/alarm/disarm",
  authenticate,
  requireCompanyAccess,
  requirePermission("command:create"),
  validate({ params: assetIdParams }),
  async (req, res) => {
    const cmd = await commandService.enqueueAssetCommand(
      req.tenant!.companyId,
      req.params.id as string,
      "disarm_alarm",
      req.user!.userId,
    );
    res.status(201).json({ data: cmd });
  },
);

export default router;
