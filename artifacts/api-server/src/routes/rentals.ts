import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as rentalService from "../services/rental.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const createRentalSchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  assetId: z.string().uuid(),
  rentalPlanId: z.string().uuid().optional(),
  depositAmount: z.string().optional(),
  startAt: z.string().optional(),
  plannedEndAt: z.string().optional(),
  notes: z.string().optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const extendSchema = z.object({
  newEndDate: z.string(),
  reason: z.string().optional(),
});

const cancelSchema = z.object({ reason: z.string().optional() });

const returnSchema = z.object({
  returnedToStationId: z.string().uuid().optional(),
  assetReturnStatus: z.enum(["available", "maintenance", "charging"]).optional(),
  notes: z.string().optional(),
});

router.post(
  "/rentals",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:create"),
  validate({ body: createRentalSchema }),
  async (req, res) => {
    const rental = await rentalService.createRental(
      {
        ...req.body,
        companyId: req.tenant!.companyId,
        issuedByUserId: req.user!.userId,
        startAt: req.body.startAt ? new Date(req.body.startAt) : null,
        plannedEndAt: req.body.plannedEndAt ? new Date(req.body.plannedEndAt) : null,
      },
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "rental",
      entityId: rental.id,
      after: rental,
      req,
    });
    res.status(201).json({ data: rental });
  },
);

router.get(
  "/rentals",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:read"),
  async (req, res) => {
    const status = req.query.status as string | undefined;
    const rentals = await rentalService.listRentals(req.tenant!.companyId, status);
    res.json({ data: rentals });
  },
);

router.get(
  "/rentals/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const rental = await rentalService.getRental(req.params.id, req.tenant!.companyId);
    res.json({ data: rental });
  },
);

router.get(
  "/rentals/:id/status-history",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const history = await rentalService.getRentalStatusHistory(req.params.id, req.tenant!.companyId);
    res.json({ data: history });
  },
);

router.post(
  "/rentals/:id/approve",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:approve"),
  validate({ params: idParams }),
  async (req, res) => {
    const { updated, previousStatus } = await rentalService.approveRental(req.params.id, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "approve",
      entityType: "rental",
      entityId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      req,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/rentals/:id/start",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:start"),
  validate({ params: idParams }),
  async (req, res) => {
    const { updated, previousStatus } = await rentalService.startRental(req.params.id, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "start",
      entityType: "rental",
      entityId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      req,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/rentals/:id/extend",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:extend"),
  validate({ params: idParams, body: extendSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await rentalService.extendRental(
      req.params.id,
      req.tenant!.companyId,
      new Date(req.body.newEndDate),
      req.user!.userId,
      req.body.reason,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "extend",
      entityType: "rental",
      entityId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status, plannedEndAt: updated.plannedEndAt },
      req,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/rentals/:id/return",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:complete"),
  validate({ params: idParams, body: returnSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await rentalService.returnRental(
      req.params.id,
      req.tenant!.companyId,
      req.body,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "return",
      entityType: "rental",
      entityId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status, actualEndAt: updated.actualEndAt },
      req,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/rentals/:id/cancel",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:cancel"),
  validate({ params: idParams, body: cancelSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await rentalService.cancelRental(
      req.params.id,
      req.tenant!.companyId,
      req.user!.userId,
      req.body.reason,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "cancel",
      entityType: "rental",
      entityId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      metadata: req.body.reason ? { reason: req.body.reason } : undefined,
      req,
    });
    res.json({ data: updated });
  },
);

export default router;
