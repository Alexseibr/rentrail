import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as inquiryService from "../services/inquiry.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const updateInquirySchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  phone: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  message: z.string().max(2000).optional(),
  assetType: z.string().optional(),
});

router.get(
  "/inquiries",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:read"),
  async (req, res) => {
    const status = req.query.status as string | undefined;
    const list = await inquiryService.listInquiries(
      req.tenant!.companyId,
      status,
    );
    res.json({ data: list });
  },
);

router.get(
  "/inquiries/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const inquiry = await inquiryService.getInquiry(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: inquiry });
  },
);

router.patch(
  "/inquiries/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:update"),
  validate({ params: idParams, body: updateInquirySchema }),
  async (req, res) => {
    const inquiry = await inquiryService.updateInquiry(
      req.params.id as string,
      req.tenant!.companyId,
      req.body as z.infer<typeof updateInquirySchema>,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "inquiry",
      entityId: inquiry.id,
      req,
    });
    res.json({ data: inquiry });
  },
);

router.post(
  "/inquiries/:id/mark-contacted",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const inquiry = await inquiryService.markContacted(
      req.params.id as string,
      req.tenant!.companyId,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "mark_contacted",
      entityType: "inquiry",
      entityId: inquiry.id,
      req,
    });
    res.json({ data: inquiry });
  },
);

router.post(
  "/inquiries/:id/convert-to-client",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:update", "client:create"),
  validate({ params: idParams }),
  async (req, res) => {
    const inquiry = await inquiryService.convertToClient(
      req.params.id as string,
      req.tenant!.companyId,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "convert_to_client",
      entityType: "inquiry",
      entityId: inquiry.id,
      after: { convertedClientId: inquiry.convertedClientId },
      req,
    });
    res.json({ data: inquiry });
  },
);

router.post(
  "/inquiries/:id/convert-to-rental-draft",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:update", "rental:create"),
  validate({ params: idParams }),
  async (req, res) => {
    const result = await inquiryService.convertToRentalDraft(
      req.params.id as string,
      req.tenant!.companyId,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "convert_to_rental_draft",
      entityType: "inquiry",
      entityId: result.inquiry.id,
      after: { convertedRentalId: result.rental.id },
      req,
    });
    res.json({ data: result });
  },
);

router.post(
  "/inquiries/:id/reject",
  authenticate,
  requireCompanyAccess,
  requirePermission("inquiry:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const inquiry = await inquiryService.rejectInquiry(
      req.params.id as string,
      req.tenant!.companyId,
      req.user!.userId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "reject",
      entityType: "inquiry",
      entityId: inquiry.id,
      req,
    });
    res.json({ data: inquiry });
  },
);

export default router;
