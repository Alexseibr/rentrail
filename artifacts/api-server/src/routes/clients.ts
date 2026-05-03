import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as clientService from "../services/client.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const createClientSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  notes: z.string().optional(),
});

const updateClientSchema = createClientSchema.partial();
const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/clients",
  authenticate,
  requireCompanyAccess,
  requirePermission("client:create"),
  validate({ body: createClientSchema }),
  async (req, res) => {
    const client = await clientService.createClient({
      ...req.body,
      companyId: req.tenant!.companyId,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "client",
      entityId: client.id,
      after: client,
      req,
    });
    res.status(201).json({ data: client });
  },
);

router.get(
  "/clients",
  authenticate,
  requireCompanyAccess,
  requirePermission("client:read"),
  async (req, res) => {
    const clients = await clientService.listClients(req.tenant!.companyId);
    res.json({ data: clients });
  },
);

router.get(
  "/clients/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("client:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const client = await clientService.getClient(req.params.id as string, req.tenant!.companyId);
    res.json({ data: client });
  },
);

router.patch(
  "/clients/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("client:update"),
  validate({ params: idParams, body: updateClientSchema }),
  async (req, res) => {
    const old = await clientService.getClient(req.params.id as string, req.tenant!.companyId);
    const client = await clientService.updateClient(req.params.id as string, req.tenant!.companyId, req.body);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "client",
      entityId: client.id,
      before: old,
      after: client,
      req,
    });
    res.json({ data: client });
  },
);

router.post(
  "/clients/:id/archive",
  authenticate,
  requireCompanyAccess,
  requirePermission("client:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const client = await clientService.archiveClient(req.params.id as string, req.tenant!.companyId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "archive",
      entityType: "client",
      entityId: client.id,
      req,
    });
    res.json({ data: client });
  },
);

router.post(
  "/clients/:id/restore",
  authenticate,
  requireCompanyAccess,
  requirePermission("client:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const client = await clientService.restoreClient(req.params.id as string, req.tenant!.companyId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "restore",
      entityType: "client",
      entityId: client.id,
      req,
    });
    res.json({ data: client });
  },
);

export default router;
