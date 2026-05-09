import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import { authenticateApiKey } from "../middlewares/api-key-auth";
import * as telemetryService from "../services/telemetry.service";

const router: IRouter = Router();

const ingestSchema = z.object({
  provider: z.string().min(1).max(100).optional(),
  deviceExternalId: z.string().max(255).optional(),
  deviceId: z.string().uuid().optional(),
  recordedAt: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  batteryPercent: z.number().int().min(0).max(100).optional(),
  batteryVoltage: z.number().optional(),
  lockState: z.string().max(20).optional(),
  alarmState: z.string().max(20).optional(),
  onlineState: z.string().max(20).optional(),
  odometer: z.number().optional(),
  rawPayload: z.unknown().optional(),
  events: z
    .array(
      z.object({
        eventType: z.string().min(1),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        payload: z.unknown().optional(),
      }),
    )
    .optional(),
});

const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/telemetry/ingest",
  authenticateApiKey,
  validate({ body: ingestSchema }),
  async (req, res) => {
    const ctx = req.apiKeyContext!;
    const { provider, ...rest } = req.body as z.infer<typeof ingestSchema>;
    const result = await telemetryService.ingestTelemetry(
      { ...rest, provider: provider ?? ctx.provider },
      { companyId: ctx.companyId, provider: ctx.provider },
    );
    res.json({ data: result });
  },
);

router.get(
  "/telemetry/assets/:id/latest",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const snap = await telemetryService.getLatestSnapshotForAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: snap });
  },
);

router.get(
  "/telemetry/assets/:id/events",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const { from, to, eventType, severity, limit, offset } =
      req.query as Record<string, string>;
    const events = await telemetryService.getEventsForAsset(
      req.params.id as string,
      req.tenant!.companyId,
      {
        from,
        to,
        eventType,
        severity,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
    );
    res.json({ data: events });
  },
);

router.get(
  "/telemetry/assets/:id/locations",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const { from, to, limit, offset } = req.query as Record<string, string>;
    const locations = await telemetryService.getLocationsForAsset(
      req.params.id as string,
      req.tenant!.companyId,
      {
        from,
        to,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
    );
    res.json({ data: locations });
  },
);

router.get(
  "/telemetry/devices/:id/latest",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const snap = await telemetryService.getLatestSnapshotForDevice(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: snap });
  },
);

router.get(
  "/telemetry/devices/:id/events",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const { from, to, eventType, severity, limit, offset } =
      req.query as Record<string, string>;
    const events = await telemetryService.getEventsForDevice(
      req.params.id as string,
      req.tenant!.companyId,
      {
        from,
        to,
        eventType,
        severity,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
    );
    res.json({ data: events });
  },
);

export default router;
