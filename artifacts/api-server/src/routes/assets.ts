import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompany } from "../middlewares/authorize";
import * as assetService from "../services/asset.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const assetTypeValues = ["bike", "ebike", "scooter", "escooter"] as const;
const assetStatusValues = [
  "draft", "available", "reserved", "awaiting_pickup", "rented",
  "overdue", "charging", "maintenance", "blocked", "lost", "stolen", "retired",
] as const;

const createAssetSchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  assetType: z.enum(assetTypeValues),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  internalCode: z.string().optional(),
  qrCode: z.string().optional(),
  status: z.enum(assetStatusValues).optional(),
  purchasePrice: z.string().optional(),
  currentValue: z.string().optional(),
  isPublic: z.boolean().optional(),
  notes: z.string().optional(),
});

const updateAssetSchema = createAssetSchema.partial();
const idParams = z.object({ id: z.string().uuid() });

const changeStatusSchema = z.object({
  status: z.enum(assetStatusValues),
  reason: z.string().optional(),
});

router.post(
  "/assets",
  authenticate,
  requireCompany,
  validate({ body: createAssetSchema }),
  async (req, res) => {
    const asset = await assetService.createAsset({
      ...req.body,
      companyId: req.tenant!.companyId,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "create",
      entityType: "asset",
      entityId: asset.id,
      newValues: asset,
      req,
    });
    res.status(201).json({ data: asset });
  },
);

router.get(
  "/assets",
  authenticate,
  requireCompany,
  async (req, res) => {
    const { branchId, status } = req.query as { branchId?: string; status?: string };
    const assets = await assetService.listAssets(req.tenant!.companyId, branchId, status);
    res.json({ data: assets });
  },
);

router.get(
  "/assets/:id",
  authenticate,
  requireCompany,
  validate({ params: idParams }),
  async (req, res) => {
    const asset = await assetService.getAsset(req.params.id, req.tenant!.companyId);
    res.json({ data: asset });
  },
);

router.patch(
  "/assets/:id",
  authenticate,
  requireCompany,
  validate({ params: idParams, body: updateAssetSchema }),
  async (req, res) => {
    const old = await assetService.getAsset(req.params.id, req.tenant!.companyId);
    const asset = await assetService.updateAsset(req.params.id, req.tenant!.companyId, req.body);
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "update",
      entityType: "asset",
      entityId: asset.id,
      oldValues: old,
      newValues: asset,
      req,
    });
    res.json({ data: asset });
  },
);

router.post(
  "/assets/:id/status",
  authenticate,
  requireCompany,
  validate({ params: idParams, body: changeStatusSchema }),
  async (req, res) => {
    const asset = await assetService.changeAssetStatus(
      req.params.id,
      req.tenant!.companyId,
      req.body.status,
      req.user!.userId,
      req.body.reason,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "status_change",
      entityType: "asset",
      entityId: asset.id,
      newValues: { status: req.body.status },
      req,
    });
    res.json({ data: asset });
  },
);

export default router;
