import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
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
  requireRole("superAdmin", "owner", "admin", "manager", "operator"),
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
  requireRole("superAdmin", "owner", "admin", "manager", "accountant", "operator", "viewer"),
  async (req, res) => {
    const clients = await clientService.listClients(req.tenant!.companyId);
    res.json({ data: clients });
  },
);

router.get(
  "/clients/:id",
  authenticate,
  requireRole("superAdmin", "owner", "admin", "manager", "accountant", "operator", "viewer"),
  validate({ params: idParams }),
  async (req, res) => {
    const client = await clientService.getClient(req.params.id, req.tenant!.companyId);
    res.json({ data: client });
  },
);

router.patch(
  "/clients/:id",
  authenticate,
  requireRole("superAdmin", "owner", "admin", "manager", "operator"),
  validate({ params: idParams, body: updateClientSchema }),
  async (req, res) => {
    const old = await clientService.getClient(req.params.id, req.tenant!.companyId);
    const client = await clientService.updateClient(req.params.id, req.tenant!.companyId, req.body);
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

export default router;
