import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import { requirePlatformRole, requireAnyPlatformRole } from "../middlewares/platform-authorize";
import * as companyService from "../services/company.service";
import * as platformCompanyService from "../services/platform-company.service";
import { createAuditLog } from "../lib/audit";
import { createPlatformAuditLog } from "../lib/platform-audit";

const router: IRouter = Router();

const createCompanySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  logoUrl: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

const updateCompanySchema = createCompanySchema.partial();
const idParams = z.object({ id: z.string().uuid() });

const moderationActionSchema = z.object({
  reasonCode: z.string().min(1),
  reasonText: z.string().min(1),
});

const companyStatusValues = ["pending", "trial", "active", "past_due", "suspended", "blocked", "canceled"] as const;
const platformListQuery = z.object({
  search: z.string().optional(),
  status: z.enum(companyStatusValues).optional(),
  plan: z.string().optional(),
  hasModeration: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["name", "slug", "status", "country", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

router.post(
  "/companies",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ body: createCompanySchema }),
  async (req, res) => {
    const company = await companyService.createCompany(req.body);
    await createPlatformAuditLog(req, {
      action: "company.create",
      entityType: "company",
      entityId: company.id,
      after: company,
    });
    res.status(201).json({ data: company });
  },
);

router.get(
  "/platform/companies",
  authenticate,
  requireAnyPlatformRole,
  validate({ query: platformListQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "company.list_all",
      entityType: "company",
    });
    const result = await platformCompanyService.listPlatformCompanies({
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      plan: req.query.plan as string | undefined,
      hasModeration: req.query.hasModeration as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      sortBy: req.query.sortBy as "name" | "slug" | "status" | "country" | "createdAt" | undefined,
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
    });
    res.json({ data: result });
  },
);

router.get(
  "/platform/companies/:id",
  authenticate,
  requireAnyPlatformRole,
  validate({ params: idParams }),
  async (req, res) => {
    const detail = await platformCompanyService.getPlatformCompanyDetail(req.params.id as string);
    await createPlatformAuditLog(req, {
      action: "company.detail",
      entityType: "company",
      entityId: detail.id,
      targetCompanyId: detail.id,
    });
    res.json({ data: detail });
  },
);

router.patch(
  "/platform/companies/:id",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ params: idParams, body: updateCompanySchema }),
  async (req, res) => {
    const old = await companyService.getCompany(req.params.id as string);
    const company = await companyService.updateCompany(req.params.id as string, req.body);
    await createPlatformAuditLog(req, {
      action: "company.update",
      entityType: "company",
      entityId: company.id,
      targetCompanyId: company.id,
      before: old,
      after: company,
    });
    res.json({ data: company });
  },
);

router.post(
  "/platform/companies/:id/approve",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ params: idParams, body: moderationActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await platformCompanyService.approveCompany(
      req.params.id as string,
      { ...req.body, performedBy: req.user!.userId },
    );
    await createPlatformAuditLog(req, {
      action: "company.approve",
      entityType: "company",
      entityId: updated.id,
      targetCompanyId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      reasonCode: req.body.reasonCode,
      reasonText: req.body.reasonText,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/companies/:id/block",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ params: idParams, body: moderationActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await platformCompanyService.blockCompany(
      req.params.id as string,
      { ...req.body, performedBy: req.user!.userId },
    );
    await createPlatformAuditLog(req, {
      action: "company.block",
      entityType: "company",
      entityId: updated.id,
      targetCompanyId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      reasonCode: req.body.reasonCode,
      reasonText: req.body.reasonText,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/companies/:id/unblock",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ params: idParams, body: moderationActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await platformCompanyService.unblockCompany(
      req.params.id as string,
      { ...req.body, performedBy: req.user!.userId },
    );
    await createPlatformAuditLog(req, {
      action: "company.unblock",
      entityType: "company",
      entityId: updated.id,
      targetCompanyId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      reasonCode: req.body.reasonCode,
      reasonText: req.body.reasonText,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/companies/:id/suspend",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ params: idParams, body: moderationActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await platformCompanyService.suspendCompany(
      req.params.id as string,
      { ...req.body, performedBy: req.user!.userId },
    );
    await createPlatformAuditLog(req, {
      action: "company.suspend",
      entityType: "company",
      entityId: updated.id,
      targetCompanyId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      reasonCode: req.body.reasonCode,
      reasonText: req.body.reasonText,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/companies/:id/cancel",
  authenticate,
  requirePlatformRole("superAdmin"),
  validate({ params: idParams, body: moderationActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await platformCompanyService.cancelCompany(
      req.params.id as string,
      { ...req.body, performedBy: req.user!.userId },
    );
    await createPlatformAuditLog(req, {
      action: "company.cancel",
      entityType: "company",
      entityId: updated.id,
      targetCompanyId: updated.id,
      before: { status: previousStatus },
      after: { status: updated.status },
      reasonCode: req.body.reasonCode,
      reasonText: req.body.reasonText,
    });
    res.json({ data: updated });
  },
);

router.get(
  "/platform/companies/:id/usage",
  authenticate,
  requireAnyPlatformRole,
  validate({ params: idParams }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "company.usage",
      entityType: "company",
      entityId: req.params.id as string,
      targetCompanyId: req.params.id as string,
    });
    const usage = await platformCompanyService.getCompanyUsage(req.params.id as string);
    res.json({ data: usage });
  },
);

router.get(
  "/platform/companies/:id/health",
  authenticate,
  requireAnyPlatformRole,
  validate({ params: idParams }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "company.health",
      entityType: "company",
      entityId: req.params.id as string,
      targetCompanyId: req.params.id as string,
    });
    const health = await platformCompanyService.getCompanyHealthSummary(req.params.id as string);
    res.json({ data: health });
  },
);

router.get(
  "/companies",
  authenticate,
  async (req, res) => {
    const companies = await companyService.listUserCompanies(req.user!.userId);
    res.json({ data: companies });
  },
);

router.get(
  "/companies/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("company:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const company = await companyService.getCompany(req.params.id as string);
    res.json({ data: company });
  },
);

router.patch(
  "/companies/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("company:update"),
  validate({ params: idParams, body: updateCompanySchema }),
  async (req, res) => {
    if (!req.user!.isSuperAdmin && req.params.id as string !== req.tenant!.companyId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Cannot update a different company" } });
      return;
    }
    const old = await companyService.getCompany(req.params.id as string);
    const company = await companyService.updateCompany(req.params.id as string, req.body);
    await createAuditLog({
      companyId: company.id,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "company",
      entityId: company.id,
      before: old,
      after: company,
      req,
    });
    res.json({ data: company });
  },
);

export default router;
