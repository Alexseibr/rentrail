import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess, requirePermission } from "../middlewares/authorize";
import * as blacklistService from "../services/blacklist.service";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

const blacklistScopes = ["branch", "company", "global"] as const;
const blacklistActionTypes = [
  "warning", "manual_approval_only", "increased_deposit",
  "restricted_access", "blocked_branch", "blocked_company", "blocked_global",
] as const;

const createBlacklistSchema = z.object({
  branchId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  scopeType: z.enum(blacklistScopes),
  actionType: z.enum(blacklistActionTypes),
  reasonCode: z.string().min(1),
  reasonText: z.string().optional(),
  fullNameSnapshot: z.string().optional(),
  phoneSnapshot: z.string().optional(),
  emailSnapshot: z.string().optional(),
  documentSnapshot: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const checkBlacklistSchema = z.object({
  clientId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

router.post(
  "/blacklist",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:create"),
  validate({ body: createBlacklistSchema }),
  async (req, res) => {
    const entry = await blacklistService.createBlacklistEntry({
      ...req.body,
      companyId: req.tenant!.companyId,
      createdByUserId: req.user!.userId,
      startsAt: req.body.startsAt ? new Date(req.body.startsAt) : new Date(),
      endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "blacklist_entry",
      entityId: entry.id,
      after: entry,
      req,
    });
    res.status(201).json({ data: entry });
  },
);

router.get(
  "/blacklist",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:read"),
  async (req, res) => {
    const entries = await blacklistService.listBlacklistEntries(req.tenant!.companyId);
    res.json({ data: entries });
  },
);

router.post(
  "/blacklist/check",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:check"),
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
