import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import * as companyService from "../services/company.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const createCompanySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

const updateCompanySchema = createCompanySchema.partial();

const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/companies",
  authenticate,
  validate({ body: createCompanySchema }),
  async (req, res) => {
    const company = await companyService.createCompany(req.body);
    await createAuditLog({
      companyId: company.id,
      userId: req.user!.userId,
      action: "create",
      entityType: "company",
      entityId: company.id,
      newValues: company,
      req,
    });
    res.status(201).json({ data: company });
  },
);

router.get(
  "/companies",
  authenticate,
  async (_req, res) => {
    const companies = await companyService.listCompanies();
    res.json({ data: companies });
  },
);

router.get(
  "/companies/:id",
  authenticate,
  validate({ params: idParams }),
  async (req, res) => {
    const company = await companyService.getCompany(req.params.id);
    res.json({ data: company });
  },
);

router.patch(
  "/companies/:id",
  authenticate,
  validate({ params: idParams, body: updateCompanySchema }),
  async (req, res) => {
    const old = await companyService.getCompany(req.params.id);
    const company = await companyService.updateCompany(req.params.id, req.body);
    await createAuditLog({
      companyId: company.id,
      userId: req.user!.userId,
      action: "update",
      entityType: "company",
      entityId: company.id,
      oldValues: old,
      newValues: company,
      req,
    });
    res.json({ data: company });
  },
);

export default router;
