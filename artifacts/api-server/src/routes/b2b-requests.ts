import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as b2bService from "../services/b2b-request.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const updateB2BSchema = z.object({
  notesInternal: z.string().max(5000).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

router.get(
  "/b2b-requests",
  authenticate,
  requireCompanyAccess,
  requirePermission("b2b:read"),
  async (req, res) => {
    const status = req.query.status as string | undefined;
    const list = await b2bService.listB2BRequests(req.tenant!.companyId, status);
    res.json({ data: list });
  },
);

router.get(
  "/b2b-requests/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("b2b:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const request = await b2bService.getB2BRequest(req.params.id as string, req.tenant!.companyId);
    res.json({ data: request });
  },
);

router.patch(
  "/b2b-requests/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("b2b:update"),
  validate({ params: idParams, body: updateB2BSchema }),
  async (req, res) => {
    const request = await b2bService.updateB2BRequest(req.params.id as string, req.tenant!.companyId, req.body);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "b2b_request",
      entityId: request.id,
      req,
    });
    res.json({ data: request });
  },
);

router.post(
  "/b2b-requests/:id/mark-contacted",
  authenticate,
  requireCompanyAccess,
  requirePermission("b2b:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const request = await b2bService.markContacted(req.params.id as string, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "mark_contacted",
      entityType: "b2b_request",
      entityId: request.id,
      req,
    });
    res.json({ data: request });
  },
);

router.post(
  "/b2b-requests/:id/convert",
  authenticate,
  requireCompanyAccess,
  requirePermission("b2b:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const request = await b2bService.convertB2BRequest(req.params.id as string, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "convert",
      entityType: "b2b_request",
      entityId: request.id,
      req,
    });
    res.json({ data: request });
  },
);

router.post(
  "/b2b-requests/:id/reject",
  authenticate,
  requireCompanyAccess,
  requirePermission("b2b:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const request = await b2bService.rejectB2BRequest(req.params.id as string, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "reject",
      entityType: "b2b_request",
      entityId: request.id,
      req,
    });
    res.json({ data: request });
  },
);

export default router;
