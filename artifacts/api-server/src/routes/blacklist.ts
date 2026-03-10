import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as blacklistService from "../services/blacklist.service";
import { createAuditLog } from "../lib/audit";
import { getBody } from "../lib/request-body";

const router: IRouter = Router();

const blacklistScopes = ["branch", "company", "global"] as const;
const blacklistActionTypes = [
  "warning",
  "manual_approval_only",
  "increased_deposit",
  "restricted_access",
  "blocked_branch",
  "blocked_company",
  "blocked_global",
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

const idParams = z.object({ id: z.string().uuid() });

router.post(
  "/blacklist",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:create"),
  validate({ body: createBlacklistSchema }),
  async (req, res) => {
    const { startsAt, endsAt, ...rest } =
      getBody<z.infer<typeof createBlacklistSchema>>(req);
    const entry = await blacklistService.createBlacklistEntry({
      ...rest,
      companyId: req.tenant!.companyId,
      createdByUserId: req.user!.userId,
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      endsAt: endsAt ? new Date(endsAt) : null,
    });
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "create",
      entityType: "blacklist_entry",
      entityId: entry.id,
      after: entry,
      metadata: { scopeType: entry.scopeType, actionType: entry.actionType },
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
    const entries = await blacklistService.listBlacklistEntries(
      req.tenant!.companyId,
    );
    res.json({ data: entries });
  },
);

router.get(
  "/blacklist/:id",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const entry = await blacklistService.getBlacklistEntry(
      req.params.id as string,
      req.tenant!.companyId,
    );
    res.json({ data: entry });
  },
);

router.post(
  "/blacklist/:id/revoke",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:create"),
  validate({ params: idParams }),
  async (req, res) => {
    const before = await blacklistService.getBlacklistEntry(
      req.params.id as string,
      req.tenant!.companyId,
    );
    const entry = await blacklistService.revokeBlacklistEntry(
      req.params.id as string,
      req.tenant!.companyId,
    );
    await createAuditLog({
      companyId: req.tenant!.companyId,
      actorUserId: req.user!.userId,
      action: "revoke",
      entityType: "blacklist_entry",
      entityId: entry.id,
      before: { endsAt: before.endsAt, actionType: before.actionType },
      after: { endsAt: entry.endsAt },
      req,
    });
    res.json({ data: entry });
  },
);

router.post(
  "/blacklist/check",
  authenticate,
  requireCompanyAccess,
  requirePermission("blacklist:check"),
  validate({ body: checkBlacklistSchema }),
  async (req, res) => {
    const { clientId, branchId } =
      getBody<z.infer<typeof checkBlacklistSchema>>(req);
    const result = await blacklistService.checkClientBlacklist(
      clientId,
      req.tenant!.companyId,
      branchId,
    );
    res.json({
      data: {
        isBlacklisted: result.isBlacklisted,
        isBlocked: result.isBlocked,
        strongestAction: result.strongestAction,
        strongestSeverity: result.strongestSeverity,
        entries: result.entries.map((e) => ({
          id: e.id,
          scopeType: e.scopeType,
          actionType: e.actionType,
          reasonCode: e.reasonCode,
          reasonText: e.reasonText,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
        })),
      },
    });
  },
);

export default router;
