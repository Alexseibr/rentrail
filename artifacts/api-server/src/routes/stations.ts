import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompany } from "../middlewares/authorize";
import * as stationService from "../services/station.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const createStationSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  capacity: z.string().optional(),
  contactPhone: z.string().optional(),
});

const updateStationSchema = createStationSchema.partial();
const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/stations",
  authenticate,
  requireCompany,
  validate({ body: createStationSchema }),
  async (req, res) => {
    const station = await stationService.createStation({
      ...req.body,
      companyId: req.tenant!.companyId,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "create",
      entityType: "station",
      entityId: station.id,
      newValues: station,
      req,
    });
    res.status(201).json({ data: station });
  },
);

router.get(
  "/stations",
  authenticate,
  requireCompany,
  async (req, res) => {
    const branchId = req.query.branchId as string | undefined;
    const stations = await stationService.listStations(req.tenant!.companyId, branchId);
    res.json({ data: stations });
  },
);

router.get(
  "/stations/:id",
  authenticate,
  requireCompany,
  validate({ params: idParams }),
  async (req, res) => {
    const station = await stationService.getStation(req.params.id, req.tenant!.companyId);
    res.json({ data: station });
  },
);

router.patch(
  "/stations/:id",
  authenticate,
  requireCompany,
  validate({ params: idParams, body: updateStationSchema }),
  async (req, res) => {
    const old = await stationService.getStation(req.params.id, req.tenant!.companyId);
    const station = await stationService.updateStation(req.params.id, req.tenant!.companyId, req.body);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "update",
      entityType: "station",
      entityId: station.id,
      oldValues: old,
      newValues: station,
      req,
    });
    res.json({ data: station });
  },
);

export default router;
