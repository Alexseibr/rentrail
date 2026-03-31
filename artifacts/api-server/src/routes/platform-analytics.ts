import { Router } from "express";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import { validate } from "../middlewares/validate";
import { createPlatformAuditLog } from "../lib/platform-audit";
import * as analyticsService from "../services/platform-analytics.service";

const router = Router();

const analyticsRoles = requirePlatformRole("superAdmin", "platformAdmin", "platformFinance");

const topTenantsQuery = z.object({
  metric: z.enum(["rentals", "assets"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get(
  "/platform/analytics/overview",
  authenticate,
  analyticsRoles,
  async (req, res) => {
    const data = await analyticsService.getOverview();
    await createPlatformAuditLog(req, {
      action: "platform.analytics.overview",
      entityType: "platform",
    });
    res.json({ data });
  },
);

router.get(
  "/platform/analytics/tenants",
  authenticate,
  analyticsRoles,
  validate({ query: topTenantsQuery }),
  async (req, res) => {
    const metric = (req.query.metric as "rentals" | "assets") ?? "rentals";
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = await analyticsService.getTopTenants(metric, limit);
    res.json({ data });
  },
);

router.get(
  "/platform/analytics/billing",
  authenticate,
  analyticsRoles,
  async (req, res) => {
    const data = await analyticsService.getBillingMetrics();
    await createPlatformAuditLog(req, {
      action: "platform.analytics.billing",
      entityType: "platform",
    });
    res.json({ data });
  },
);

router.get(
  "/platform/analytics/usage",
  authenticate,
  analyticsRoles,
  async (req, res) => {
    const data = await analyticsService.getUsageMetrics();
    res.json({ data });
  },
);

router.get(
  "/platform/analytics/risks",
  authenticate,
  analyticsRoles,
  async (req, res) => {
    const data = await analyticsService.getRiskMetrics();
    await createPlatformAuditLog(req, {
      action: "platform.analytics.risks",
      entityType: "platform",
    });
    res.json({ data });
  },
);

export default router;
