import { Router, type IRouter } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as reportService from "../services/report.service";

const router: IRouter = Router();

router.get(
  "/reports/live-map",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  async (req, res) => {
    const { branchId, assetType, status } = req.query as Record<string, string>;
    const data = await reportService.getLiveMapData(req.tenant!.companyId, {
      branchId,
      assetType,
      status,
    });
    res.json({ data });
  },
);

router.get(
  "/reports/low-battery-assets",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  async (req, res) => {
    const threshold = req.query.threshold
      ? parseInt(req.query.threshold as string)
      : 20;
    const data = await reportService.getLowBatteryAssets(
      req.tenant!.companyId,
      threshold,
    );
    res.json({ data });
  },
);

router.get(
  "/reports/offline-devices",
  authenticate,
  requireCompanyAccess,
  requirePermission("telemetry:read"),
  async (req, res) => {
    const thresholdMinutes = req.query.thresholdMinutes
      ? parseInt(req.query.thresholdMinutes as string)
      : 30;
    const data = await reportService.getOfflineDevices(
      req.tenant!.companyId,
      thresholdMinutes,
    );
    res.json({ data });
  },
);

export default router;
