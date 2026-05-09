import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as brandingService from "../services/branding.service";
import * as moduleService from "../services/module.service";
import { createAuditLog } from "../lib/audit";
import { getBody } from "../lib/request-body";

const router: IRouter = Router();

const updateBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().max(20).nullable().optional(),
  secondaryColor: z.string().max(20).nullable().optional(),
  publicTitle: z.string().max(255).nullable().optional(),
  publicDescription: z.string().max(5000).nullable().optional(),
  publicPhone: z.string().max(50).nullable().optional(),
  publicEmail: z.string().email().nullable().optional(),
  publicCity: z.string().max(100).nullable().optional(),
  publicAddress: z.string().max(500).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
  publicEnabled: z.boolean().optional(),
  publicShowAssets: z.boolean().optional(),
  publicShowPricing: z.boolean().optional(),
  publicShowStations: z.boolean().optional(),
  publicShowB2BForm: z.boolean().optional(),
  publicShowInquiryForm: z.boolean().optional(),
  publicTermsText: z.string().max(10000).nullable().optional(),
});

const updateModulesSchema = z.record(z.string(), z.boolean());

router.get(
  "/companies/me/branding",
  authenticate,
  requireCompanyAccess,
  requirePermission("company:read"),
  async (req, res) => {
    const branding = await brandingService.getOrCreateBranding(
      req.tenant!.companyId,
    );
    res.json({ data: branding });
  },
);

router.patch(
  "/companies/me/branding",
  authenticate,
  requireCompanyAccess,
  requirePermission("company:update"),
  validate({ body: updateBrandingSchema }),
  async (req, res) => {
    const body = getBody<z.infer<typeof updateBrandingSchema>>(req);
    const old = await brandingService.getOrCreateBranding(
      req.tenant!.companyId,
    );
    const branding = await brandingService.updateBranding(
      req.tenant!.companyId,
      body,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "company_branding",
      entityId: branding.id,
      before: old,
      after: branding,
      req,
    });
    res.json({ data: branding });
  },
);

router.get(
  "/companies/me/modules",
  authenticate,
  requireCompanyAccess,
  requirePermission("company:read"),
  async (req, res) => {
    const modules = await moduleService.getCompanyModules(
      req.tenant!.companyId,
    );
    res.json({ data: modules });
  },
);

router.patch(
  "/companies/me/modules",
  authenticate,
  requireCompanyAccess,
  requirePermission("settings:update"),
  validate({ body: updateModulesSchema }),
  async (req, res) => {
    const body = getBody<z.infer<typeof updateModulesSchema>>(req);
    const modules = await moduleService.updateCompanyModules(
      req.tenant!.companyId,
      body,
      req.user!.isSuperAdmin,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "company_modules",
      after: modules,
      req,
    });
    res.json({ data: modules });
  },
);

export default router;
