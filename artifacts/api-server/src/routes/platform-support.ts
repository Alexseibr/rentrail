import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import * as platformCompanyService from "../services/platform-company.service";
import { createPlatformAuditLog } from "../lib/platform-audit";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get(
  "/platform/support/tenants/:id/summary",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin", "platformSupport"),
  validate({ params: idParams }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "support.tenant_summary",
      entityType: "company",
      entityId: req.params.id,
      targetCompanyId: req.params.id,
    });
    const summary = await platformCompanyService.getTenantSummary(req.params.id);
    res.json({ data: summary });
  },
);

router.get(
  "/platform/support/tenants/:id/audit",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin", "platformSupport"),
  validate({ params: idParams, query: paginationQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "support.tenant_audit",
      entityType: "company",
      entityId: req.params.id,
      targetCompanyId: req.params.id,
    });
    const auditLog = await platformCompanyService.getTenantAuditLog(req.params.id, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data: auditLog });
  },
);

router.get(
  "/platform/support/tenants/:id/health",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin", "platformSupport"),
  validate({ params: idParams }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "support.tenant_health",
      entityType: "company",
      entityId: req.params.id,
      targetCompanyId: req.params.id,
    });
    const health = await platformCompanyService.getTenantHealth(req.params.id);
    res.json({ data: health });
  },
);

export default router;
