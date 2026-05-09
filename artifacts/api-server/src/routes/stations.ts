import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as stationService from "../services/station.service";
import { createAuditLog } from "../lib/audit";
import { getBody } from "../lib/request-body";

const router: IRouter = Router();

const stationTypes = [
  "hub",
  "pickup_point",
  "service_center",
  "warehouse",
] as const;

const createStationSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(stationTypes).optional(),
  address: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
});

const updateStationSchema = createStationSchema.partial();
const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/stations",
  authenticate,
  requireCompanyAccess,
  requirePermission("station:create"),
  validate({ body: createStationSchema }),
  async (req, res) => {
    const station = await stationService.createStation({
      ...getBody<z.infer<typeof createStationSchema>>(req),
      companyId: req.tenant!.companyId,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "station",
      entityId: station.id,
      after: station,
      req,
    });
    res.status(201).json({ data: station });
  },
);

router.get(
  "/stations",
  authenticate,
  requireCompanyAccess,
  requirePermission("station:read"),
  async (req, res) => {
    const branchId = req.query.branchId as string | undefined;
    const stations = await stationService.listStations(
      req.tenant!.companyId,
      branchId,
    );
    res.json({ data: stations });
  },
);

router.get(
  "/stations/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("station:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const station = await stationService.getStation(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: station });
  },
);

router.patch(
  "/stations/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("station:update"),
  validate({ params: idParams, body: updateStationSchema }),
  async (req, res) => {
    const old = await stationService.getStation(
      req.params.id as string,
      req.tenant!.companyId,
    );
    const station = await stationService.updateStation(
      req.params.id as string,
      req.tenant!.companyId,
      getBody<z.infer<typeof updateStationSchema>>(req),
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "station",
      entityId: station.id,
      before: old,
      after: station,
      req,
    });
    res.json({ data: station });
  },
);

export default router;
