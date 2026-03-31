import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import * as companyService from "../services/company.service";
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
  "/companies",
  authenticate,
  async (req, res) => {
    const dbPlatformRoles = req.platformUser?.platformRoles ?? [];
    if (req.user!.isSuperAdmin || dbPlatformRoles.length > 0) {
      await createPlatformAuditLog(req, {
        action: "company.list_all",
        entityType: "company",
      });
      const companies = await companyService.listCompanies();
      res.json({ data: companies });
      return;
    }
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
    const company = await companyService.getCompany(req.params.id);
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
    if (!req.user!.isSuperAdmin && req.params.id !== req.tenant!.companyId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Cannot update a different company" } });
      return;
    }
    const old = await companyService.getCompany(req.params.id);
    const company = await companyService.updateCompany(req.params.id, req.body);
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
