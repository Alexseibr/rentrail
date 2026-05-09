import { Router } from "express";
import { validate } from "../middlewares/validate";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as incidentService from "../services/incident.service";
import { logger } from "../lib/logger";

const createIncidentSchema = z.object({
  branchId: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  severity: z.string().optional(),
});

const statusIncidentSchema = z.object({
  status: z.string().optional(),
});

const router = Router();

const VALID_INCIDENT_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

router.get(
  "/incidents",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const statusParam = req.query.status as string | undefined;
      if (
        statusParam &&
        !VALID_INCIDENT_STATUSES.includes(
          statusParam as (typeof VALID_INCIDENT_STATUSES)[number],
        )
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: `Invalid status value: ${statusParam}`,
          },
        });
      }
      const items = await incidentService.listIncidents(
        req.tenant!.companyId,
        req.query.branchId as string | undefined,
        statusParam,
      );
      return res.json({ data: items });
    } catch (err: unknown) {
      logger.error({ err }, "GET /incidents error");
      return res.status(500).json({
        error: { code: "INTERNAL", message: (err as Error)?.message },
      });
    }
  },
);

router.get(
  "/incidents/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    try {
      const item = await incidentService.getIncident(
        String(req.params.id),
        req.tenant!.companyId,
      );
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json({ data: item });
    } catch (err: unknown) {
      logger.error({ err }, "GET /incidents/:id error");
      return res.status(500).json({
        error: { code: "INTERNAL", message: (err as Error)?.message },
      });
    }
  },
);

router.post(
  "/incidents",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: createIncidentSchema }),
  async (req, res) => {
    try {
      // type-coverage:ignore-next-line
      const { branchId, title, description, severity } = req.body as z.infer<
        typeof createIncidentSchema
      >;
      if (!title) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: "title is required" },
        });
      }
      const item = await incidentService.createIncident({
        companyId: req.tenant!.companyId,
        branchId,
        title,
        description,
        severity,
        reportedByUserId: req.user!.userId,
      });
      return res.status(201).json({ data: item });
    } catch (err: unknown) {
      logger.error({ err }, "POST /incidents error");
      return res.status(500).json({
        error: { code: "INTERNAL", message: (err as Error)?.message },
      });
    }
  },
);

router.post(
  "/incidents/:id/status",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ body: statusIncidentSchema }),
  async (req, res) => {
    try {
      // type-coverage:ignore-next-line
      const { status } = req.body as z.infer<typeof statusIncidentSchema>;
      const update: Record<string, unknown> = { status };
      if (status === "resolved") update.resolvedAt = new Date();
      const item = await incidentService.updateIncident(
        String(req.params.id),
        req.tenant!.companyId,
        update,
      );
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json({ data: item });
    } catch (err: unknown) {
      logger.error({ err }, "POST /incidents/:id/status error");
      return res.status(500).json({
        error: { code: "INTERNAL", message: (err as Error)?.message },
      });
    }
  },
);

export default router;
