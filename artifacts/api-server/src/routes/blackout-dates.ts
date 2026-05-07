import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import { db, rentalBlackoutDates } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { createAuditLog } from "../lib/audit";
import { NotFoundError } from "../lib/errors";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const createSchema = z.object({
  branchId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().max(1000).optional(),
});

const listQuery = z.object({
  branchId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get(
  "/blackout-dates",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:read"),
  validate({ query: listQuery }),
  async (req, res) => {
    const { branchId, assetId, from, to } = req.query as {
      branchId?: string;
      assetId?: string;
      from?: Date;
      to?: Date;
    };
    const conditions = [
      eq(rentalBlackoutDates.companyId, req.tenant!.companyId),
    ];
    if (branchId) conditions.push(eq(rentalBlackoutDates.branchId, branchId));
    if (assetId) conditions.push(eq(rentalBlackoutDates.assetId, assetId));
    if (from) conditions.push(gte(rentalBlackoutDates.endDate, from));
    if (to) conditions.push(lte(rentalBlackoutDates.startDate, to));

    const list = await db
      .select()
      .from(rentalBlackoutDates)
      .where(and(...conditions));
    res.json({ data: list });
  },
);

router.post(
  "/blackout-dates",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:update"),
  validate({ body: createSchema }),
  async (req, res) => {
    const [created] = await db
      .insert(rentalBlackoutDates)
      .values({
        companyId: req.tenant!.companyId,
        branchId: req.body.branchId ?? null,
        assetId: req.body.assetId ?? null,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        reason: req.body.reason ?? null,
        createdByUserId: req.user!.userId,
      })
      .returning();

    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "blackout_date",
      entityId: created.id,
      req,
    });

    res.status(201).json({ data: created });
  },
);

router.delete(
  "/blackout-dates/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("rental:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const [deleted] = await db
      .delete(rentalBlackoutDates)
      .where(
        and(
          eq(rentalBlackoutDates.id, req.params.id as string),
          eq(rentalBlackoutDates.companyId, req.tenant!.companyId),
        ),
      )
      .returning();

    if (!deleted) throw new NotFoundError("Blackout date not found");

    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "delete",
      entityType: "blackout_date",
      entityId: req.params.id as string,
      req,
    });

    res.json({ data: deleted });
  },
);

export default router;
