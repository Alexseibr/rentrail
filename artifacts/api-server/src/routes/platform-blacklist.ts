import { Router } from "express";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import { validate } from "../middlewares/validate";
import { createPlatformAuditLog } from "../lib/platform-audit";
import * as platformBlacklistService from "../services/platform-blacklist.service";

const router = Router();

const riskRoles = requirePlatformRole(
  "superAdmin",
  "platformAdmin",
  "platformRisk",
);
const idParams = z.object({ id: z.string().uuid() });

const blacklistActionTypes = [
  "warning",
  "manual_approval_only",
  "increased_deposit",
  "restricted_access",
  "blocked_branch",
  "blocked_company",
  "blocked_global",
] as const;

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  actionType: z.enum(blacklistActionTypes).optional(),
  active: z.enum(["true", "false"]).optional(),
  reasonCode: z.string().optional(),
  search: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  document: z.string().optional(),
  fullName: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const createSchema = z.object({
  actionType: z.enum(blacklistActionTypes),
  reasonCode: z.string().min(1),
  reasonText: z.string().optional(),
  fullNameSnapshot: z.string().optional(),
  phoneSnapshot: z.string().optional(),
  emailSnapshot: z.string().optional(),
  documentSnapshot: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

const updateSchema = z.object({
  actionType: z.enum(blacklistActionTypes).optional(),
  reasonCode: z.string().min(1).optional(),
  reasonText: z.string().nullable().optional(),
  fullNameSnapshot: z.string().nullable().optional(),
  phoneSnapshot: z.string().nullable().optional(),
  emailSnapshot: z.string().nullable().optional(),
  documentSnapshot: z.string().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

router.get(
  "/platform/blacklist",
  authenticate,
  riskRoles,
  validate({ query: listQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, {
      action: "platform.blacklist.list",
      entityType: "blacklist_entry",
    });
    const result = await platformBlacklistService.listGlobalBlacklistEntries({
      actionType: req.query.actionType as
        | (typeof blacklistActionTypes)[number]
        | undefined,
      active:
        req.query.active === "true"
          ? true
          : req.query.active === "false"
            ? false
            : undefined,
      reasonCode: req.query.reasonCode as string | undefined,
      search: req.query.search as string | undefined,
      phone: req.query.phone as string | undefined,
      email: req.query.email as string | undefined,
      document: req.query.document as string | undefined,
      fullName: req.query.fullName as string | undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data: result });
  },
);

router.post(
  "/platform/blacklist",
  authenticate,
  riskRoles,
  validate({ body: createSchema }),
  async (req, res) => {
    const entry = await platformBlacklistService.createGlobalBlacklistEntry({
      ...(req.body as z.infer<typeof createSchema>),
      createdByUserId: req.user!.userId,
    });
    await createPlatformAuditLog(req, {
      action: "platform.blacklist.create",
      entityType: "blacklist_entry",
      entityId: entry.id,
      after: entry,
    });
    res.status(201).json({ data: entry });
  },
);

router.get(
  "/platform/blacklist/:id",
  authenticate,
  riskRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const entry = await platformBlacklistService.getGlobalBlacklistEntry(
      req.params.id as string,
    );
    await createPlatformAuditLog(req, {
      action: "platform.blacklist.view",
      entityType: "blacklist_entry",
      entityId: entry.id,
    });
    res.json({ data: entry });
  },
);

router.patch(
  "/platform/blacklist/:id",
  authenticate,
  riskRoles,
  validate({ params: idParams, body: updateSchema }),
  async (req, res) => {
    const { updated, previous } =
      await platformBlacklistService.updateGlobalBlacklistEntry(
        req.params.id as string,
        req.body as z.infer<typeof updateSchema>,
      );
    await createPlatformAuditLog(req, {
      action: "platform.blacklist.update",
      entityType: "blacklist_entry",
      entityId: updated.id,
      before: previous,
      after: updated,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/blacklist/:id/enable",
  authenticate,
  riskRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const { updated, previous } =
      await platformBlacklistService.enableGlobalBlacklistEntry(
        req.params.id as string,
      );
    await createPlatformAuditLog(req, {
      action: "platform.blacklist.enable",
      entityType: "blacklist_entry",
      entityId: updated.id,
      before: { endsAt: previous.endsAt },
      after: { endsAt: updated.endsAt },
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/blacklist/:id/disable",
  authenticate,
  riskRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const { updated, previous } =
      await platformBlacklistService.disableGlobalBlacklistEntry(
        req.params.id as string,
      );
    await createPlatformAuditLog(req, {
      action: "platform.blacklist.disable",
      entityType: "blacklist_entry",
      entityId: updated.id,
      before: { endsAt: previous.endsAt },
      after: { endsAt: updated.endsAt },
    });
    res.json({ data: updated });
  },
);

export default router;
