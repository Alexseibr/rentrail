import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as rentalPaymentService from "../services/rental-payment.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const rentalIdParams = z.object({ id: z.string().uuid() });
const paymentIdParams = z.object({ paymentId: z.string().uuid() });

const holdSchema = z.object({
  provider: z.enum(["yukassa", "tinkoff", "cloudpayments"]),
  amountKopecks: z.number().int().positive(),
  currency: z.string().max(10).optional().default("RUB"),
  savedMethodToken: z.string().optional(),
  returnUrl: z.string().url().optional(),
  description: z.string().max(500).optional(),
});

const captureSchema = z.object({
  finalAmountKopecks: z.number().int().positive(),
  currency: z.string().max(10).optional().default("RUB"),
});

router.get(
  "/rentals/:id/payments",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:read"),
  validate({ params: rentalIdParams }),
  async (req, res) => {
    const payments = await rentalPaymentService.getRentalPayments(req.params.id as string, req.tenant!.companyId);
    res.json({ data: payments });
  },
);

router.post(
  "/rentals/:id/payment/hold",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:update"),
  validate({ params: rentalIdParams, body: holdSchema }),
  async (req, res) => {
    const result = await rentalPaymentService.holdDeposit(
      req.params.id as string,
      req.tenant!.companyId,
      req.body,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "payment",
      entityId: result.payment.id,
      req,
    });
    res.status(201).json({ data: result });
  },
);

router.post(
  "/rentals/:id/payment/capture",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:update"),
  validate({ params: rentalIdParams, body: captureSchema }),
  async (req, res) => {
    const payment = await rentalPaymentService.capturePayment(
      req.params.id as string,
      req.tenant!.companyId,
      req.body,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "payment",
      entityId: payment.id,
      req,
    });
    res.json({ data: payment });
  },
);

router.post(
  "/rentals/:id/payment/void",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:update"),
  validate({ params: rentalIdParams }),
  async (req, res) => {
    const payment = await rentalPaymentService.voidHold(
      req.params.id as string,
      req.tenant!.companyId,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "payment",
      entityId: payment.id,
      req,
    });
    res.json({ data: payment });
  },
);

router.post(
  "/rentals/:id/payments/:paymentId/refresh",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:read"),
  validate({ params: rentalIdParams.merge(paymentIdParams) }),
  async (req, res) => {
    const payment = await rentalPaymentService.refreshPaymentStatus(
      req.params.paymentId as string,
      req.tenant!.companyId,
    );
    res.json({ data: payment });
  },
);

export default router;
