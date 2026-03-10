import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as assetService from "../services/asset.service";
import { createAuditLog } from "../lib/audit";
import { getBody } from "../lib/request-body";

const router: IRouter = Router();

const assetTypeValues = ["bike", "ebike", "scooter", "escooter"] as const;
const assetStatusValues = [
  "draft",
  "available",
  "reserved",
  "awaiting_pickup",
  "rented",
  "overdue",
  "charging",
  "maintenance",
  "blocked",
  "lost",
  "stolen",
  "retired",
] as const;

const createAssetSchema = z.object({
  branchId: z.string().uuid(),
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

const updateAssetSchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  assetType: z.enum(assetTypeValues).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  internalCode: z.string().optional(),
  qrCode: z.string().optional(),
  purchasePrice: z.string().optional(),
  currentValue: z.string().optional(),
  isPublic: z.boolean().optional(),
  notes: z.string().optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const changeStatusSchema = z.object({
  status: z.enum(assetStatusValues),
  reason: z.string().optional(),
});

router.post(
  "/assets",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:create"),
  validate({ body: createAssetSchema }),
  async (req, res) => {
    const asset = await assetService.createAsset({
      ...getBody<z.infer<typeof createAssetSchema>>(req),
      companyId: req.tenant!.companyId,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "asset",
      entityId: asset.id,
      after: asset,
      req,
    });
    res.status(201).json({ data: asset });
  },
);

router.get(
  "/assets",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  async (req, res) => {
    const { branchId, status } = req.query as {
      branchId?: string;
      status?: string;
    };
    if (
      status &&
      !assetStatusValues.includes(status as (typeof assetStatusValues)[number])
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: `Invalid status value: ${status}`,
        },
      });
    }
    const assets = await assetService.listAssets(
      req.tenant!.companyId,
      branchId,
      status,
    );
    return res.json({ data: assets });
  },
);

router.get(
  "/assets/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const asset = await assetService.getAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: asset });
  },
);

router.patch(
  "/assets/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:update"),
  validate({ params: idParams, body: updateAssetSchema }),
  async (req, res) => {
    const old = await assetService.getAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    const asset = await assetService.updateAsset(
      req.params.id as string,
      req.tenant!.companyId,
      getBody<z.infer<typeof updateAssetSchema>>(req),
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "asset",
      entityId: asset.id,
      before: old,
      after: asset,
      req,
    });
    res.json({ data: asset });
  },
);

router.post(
  "/assets/:id/status",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:changeStatus"),
  validate({ params: idParams, body: changeStatusSchema }),
  async (req, res) => {
    const { status, reason } = getBody<z.infer<typeof changeStatusSchema>>(req);
    const before = await assetService.getAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    const asset = await assetService.changeAssetStatus(
      req.params.id as string,
      req.tenant!.companyId,
      status,
      req.user!.userId,
      reason,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "changeStatus",
      entityType: "asset",
      entityId: asset.id,
      before: { status: before.status },
      after: { status },
      metadata: reason ? { reason } : undefined,
      req,
    });
    res.json({ data: asset });
  },
);

router.post(
  "/assets/:id/archive",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:delete"),
  validate({ params: idParams }),
  async (req, res) => {
    const asset = await assetService.archiveAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "archive",
      entityType: "asset",
      entityId: asset.id,
      req,
    });
    res.json({ data: asset });
  },
);

router.post(
  "/assets/:id/restore",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:delete"),
  validate({ params: idParams }),
  async (req, res) => {
    const asset = await assetService.restoreAsset(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "restore",
      entityType: "asset",
      entityId: asset.id,
      req,
    });
    res.json({ data: asset });
  },
);

router.get(
  "/assets/:id/status-history",
  authenticate,
  requireCompanyAccess,
  requirePermission("asset:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const history = await assetService.getAssetStatusHistory(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: history });
  },
);

export default router;
