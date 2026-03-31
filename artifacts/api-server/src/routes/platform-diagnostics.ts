import { Router } from "express";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import { validate } from "../middlewares/validate";
import { createPlatformAuditLog } from "../lib/platform-audit";
import * as diagService from "../services/platform-diagnostics.service";
import { AppError } from "../lib/errors";

const router = Router();

const adminRoles = requirePlatformRole("superAdmin", "platformAdmin");

const serviceNameParams = z.object({
  serviceName: z.enum(["email", "storage", "queues", "telemetry-ingest", "mobile-push"]),
});

router.get(
  "/platform/health/summary",
  authenticate,
  adminRoles,
  async (req, res) => {
    const summary = await diagService.getPlatformHealthSummary();
    await createPlatformAuditLog(req, {
      action: "platform.health.summary",
      entityType: "platform",
    });
    res.json({ data: summary });
  },
);

router.get(
  "/platform/health/tenants",
  authenticate,
  adminRoles,
  async (req, res) => {
    const tenants = await diagService.getTenantHealthList();
    await createPlatformAuditLog(req, {
      action: "platform.health.tenants",
      entityType: "platform",
    });
    res.json({ data: tenants });
  },
);

router.get(
  "/platform/health/services",
  authenticate,
  adminRoles,
  async (req, res) => {
    const services = diagService.getAllServiceStatuses();
    await createPlatformAuditLog(req, {
      action: "platform.health.services",
      entityType: "platform",
    });
    res.json({ data: services });
  },
);

router.get(
  "/platform/diagnostics/:serviceName",
  authenticate,
  adminRoles,
  validate({ params: serviceNameParams }),
  async (req, res) => {
    const status = diagService.getServiceStatus(req.params.serviceName);
    if (!status) throw new AppError(404, "Unknown service", "SERVICE_NOT_FOUND");
    await createPlatformAuditLog(req, {
      action: "platform.diagnostics.check",
      entityType: "service",
      metadata: { serviceName: req.params.serviceName },
    });
    res.json({ data: status });
  },
);

export default router;
