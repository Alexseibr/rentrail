import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompany } from "../middlewares/authorize";
import * as blacklistService from "../services/blacklist.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const blacklistLevels = ["branch", "company", "global"] as const;
const blacklistActions = [
  "warning", "manual_approval_only", "increased_deposit",
  "restricted_access", "blocked_branch", "blocked_company", "blocked_global",
] as const;

const createBlacklistSchema = z.object({
  branchId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  level: z.enum(blacklistLevels),
  action: z.enum(blacklistActions),
  reason: z.string().min(1),
  expiresAt: z.string().optional(),
});

const checkBlacklistSchema = z.object({
  clientId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

router.post(
  "/blacklist",
  authenticate,
  requireCompany,
  validate({ body: createBlacklistSchema }),
  async (req, res) => {
    const entry = await blacklistService.createBlacklistEntry({
      ...req.body,
      companyId: req.tenant!.companyId,
      createdBy: req.user!.userId,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      userId: req.user!.userId,
      action: "create",
      entityType: "blacklist_entry",
      entityId: entry.id,
      newValues: entry,
      req,
    });
    res.status(201).json({ data: entry });
  },
);

router.get(
  "/blacklist",
  authenticate,
  requireCompany,
  async (req, res) => {
    const entries = await blacklistService.listBlacklistEntries(req.tenant!.companyId);
    res.json({ data: entries });
  },
);

router.post(
  "/blacklist/check",
  authenticate,
  requireCompany,
  validate({ body: checkBlacklistSchema }),
  async (req, res) => {
    const result = await blacklistService.checkClientBlacklist(
      req.body.clientId,
      req.tenant!.companyId,
      req.body.branchId,
    );
    res.json({ data: result });
  },
);

export default router;
