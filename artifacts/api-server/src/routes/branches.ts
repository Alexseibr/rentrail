import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as branchService from "../services/branch.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const createBranchSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
});

const updateBranchSchema = createBranchSchema.partial();
const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/branches",
  authenticate,
  requireCompanyAccess,
  requirePermission("branch:create"),
  validate({ body: createBranchSchema }),
  async (req, res) => {
    const branch = await branchService.createBranch({
      ...(req.body as z.infer<typeof createBranchSchema>),
      companyId: req.tenant!.companyId,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "branch",
      entityId: branch.id,
      after: branch,
      req,
    });
    res.status(201).json({ data: branch });
  },
);

router.get(
  "/branches",
  authenticate,
  requireCompanyAccess,
  requirePermission("branch:read"),
  async (req, res) => {
    const branches = await branchService.listBranches(req.tenant!.companyId);
    res.json({ data: branches });
  },
);

router.get(
  "/branches/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("branch:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const branch = await branchService.getBranch(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: branch });
  },
);

router.patch(
  "/branches/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("branch:update"),
  validate({ params: idParams, body: updateBranchSchema }),
  async (req, res) => {
    const old = await branchService.getBranch(
      req.params.id as string,
      req.tenant!.companyId,
    );
    const branch = await branchService.updateBranch(
      req.params.id as string,
      req.tenant!.companyId,
      req.body as z.infer<typeof updateBranchSchema>,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "update",
      entityType: "branch",
      entityId: branch.id,
      before: old,
      after: branch,
      req,
    });
    res.json({ data: branch });
  },
);

router.post(
  "/branches/:id/deactivate",
  authenticate,
  requireCompanyAccess,
  requirePermission("branch:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const { branch, previousStatus } = await branchService.deactivateBranch(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "deactivate",
      entityType: "branch",
      entityId: branch.id,
      before: { status: previousStatus },
      after: { status: branch.status },
      req,
    });
    res.json({ data: branch });
  },
);

router.post(
  "/branches/:id/activate",
  authenticate,
  requireCompanyAccess,
  requirePermission("branch:update"),
  validate({ params: idParams }),
  async (req, res) => {
    const { branch, previousStatus } = await branchService.activateBranch(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "activate",
      entityType: "branch",
      entityId: branch.id,
      before: { status: previousStatus },
      after: { status: branch.status },
      req,
    });
    res.json({ data: branch });
  },
);

export default router;
