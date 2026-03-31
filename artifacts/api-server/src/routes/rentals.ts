import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompany } from "../middlewares/authorize";
import * as rentalService from "../services/rental.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const createRentalSchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  assetId: z.string().uuid(),
  rentalPlanId: z.string().uuid().optional(),
  totalPrice: z.string().optional(),
  depositAmount: z.string().optional(),
  startDate: z.string().optional(),
  expectedEndDate: z.string().optional(),
  notes: z.string().optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const extendSchema = z.object({
  newEndDate: z.string(),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

router.post(
  "/rentals",
  authenticate,
  requireCompany,
  validate({ body: createRentalSchema }),
  async (req, res) => {
    const rental = await rentalService.createRental({
      ...req.body,
      companyId: req.tenant!.companyId,
      createdBy: req.user!.userId,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      expectedEndDate: req.body.expectedEndDate ? new Date(req.body.expectedEndDate) : null,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "create",
      entityType: "rental",
      entityId: rental.id,
      newValues: rental,
      req,
    });
    res.status(201).json({ data: rental });
  },
);

router.get(
  "/rentals",
  authenticate,
  requireCompany,
  async (req, res) => {
    const status = req.query.status as string | undefined;
    const rentals = await rentalService.listRentals(req.tenant!.companyId, status);
    res.json({ data: rentals });
  },
);

router.get(
  "/rentals/:id",
  authenticate,
  requireCompany,
  validate({ params: idParams }),
  async (req, res) => {
    const rental = await rentalService.getRental(req.params.id, req.tenant!.companyId);
    res.json({ data: rental });
  },
);

router.post(
  "/rentals/:id/approve",
  authenticate,
  requireCompany,
  validate({ params: idParams }),
  async (req, res) => {
    const rental = await rentalService.approveRental(req.params.id, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "approve",
      entityType: "rental",
      entityId: rental.id,
      req,
    });
    res.json({ data: rental });
  },
);

router.post(
  "/rentals/:id/start",
  authenticate,
  requireCompany,
  validate({ params: idParams }),
  async (req, res) => {
    const rental = await rentalService.startRental(req.params.id, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "start",
      entityType: "rental",
      entityId: rental.id,
      req,
    });
    res.json({ data: rental });
  },
);

router.post(
  "/rentals/:id/extend",
  authenticate,
  requireCompany,
  validate({ params: idParams, body: extendSchema }),
  async (req, res) => {
    const rental = await rentalService.extendRental(
      req.params.id,
      req.tenant!.companyId,
      new Date(req.body.newEndDate),
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "extend",
      entityType: "rental",
      entityId: rental.id,
      req,
    });
    res.json({ data: rental });
  },
);

router.post(
  "/rentals/:id/complete",
  authenticate,
  requireCompany,
  validate({ params: idParams }),
  async (req, res) => {
    const rental = await rentalService.completeRental(req.params.id, req.tenant!.companyId, req.user!.userId);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "complete",
      entityType: "rental",
      entityId: rental.id,
      req,
    });
    res.json({ data: rental });
  },
);

router.post(
  "/rentals/:id/cancel",
  authenticate,
  requireCompany,
  validate({ params: idParams, body: cancelSchema }),
  async (req, res) => {
    const rental = await rentalService.cancelRental(
      req.params.id,
      req.tenant!.companyId,
      req.user!.userId,
      req.body.reason,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "cancel",
      entityType: "rental",
      entityId: rental.id,
      req,
    });
    res.json({ data: rental });
  },
);

export default router;
