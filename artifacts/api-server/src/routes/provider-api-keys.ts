import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as keyService from "../services/provider-key.service";
import { createAuditLog } from "../lib/audit";
import { getBody } from "../lib/request-body";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const createKeySchema = z.object({
  provider: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
});

router.post(
  "/provider-api-keys",
  authenticate,
  requireCompanyAccess,
  requirePermission("settings:manage"),
  validate({ body: createKeySchema }),
  async (req, res) => {
    const result = await keyService.generateApiKey(
      req.tenant!.companyId,
      getBody<z.infer<typeof createKeySchema>>(req),
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "provider_api_key",
      entityId: result.id,
      req,
    });
    const { keyHash: _keyHash, ...safeResult } = result;
    void _keyHash;
    res.status(201).json({ data: safeResult });
  },
);

router.get(
  "/provider-api-keys",
  authenticate,
  requireCompanyAccess,
  requirePermission("settings:read"),
  async (req, res) => {
    const keys = await keyService.listApiKeys(req.tenant!.companyId);
    res.json({ data: keys });
  },
);

router.post(
  "/provider-api-keys/:id/rotate",
  authenticate,
  requireCompanyAccess,
  requirePermission("settings:manage"),
  validate({ params: idParams }),
  async (req, res) => {
    const result = await keyService.rotateApiKey(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await Promise.all([
      createAuditLog({
        companyId: req.tenant!.companyId,
        actorUserId: req.user!.userId,
        action: "revoke",
        entityType: "provider_api_key",
        entityId: result.revoked.id,
        req,
      }),
      createAuditLog({
        companyId: req.tenant!.companyId,
        actorUserId: req.user!.userId,
        action: "create",
        entityType: "provider_api_key",
        entityId: result.created.id,
        req,
      }),
    ]);
    const { keyHash: _keyHash, ...safeCreated } = result.created;
    void _keyHash;
    res.status(201).json({
      data: {
        revokedId: result.revoked.id,
        newKey: safeCreated,
      },
    });
  },
);

router.delete(
  "/provider-api-keys/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("settings:manage"),
  validate({ params: idParams }),
  async (req, res) => {
    const key = await keyService.revokeApiKey(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "revoke",
      entityType: "provider_api_key",
      entityId: key.id,
      req,
    });
    res.json({ data: key });
  },
);

export default router;
