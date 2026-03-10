import { Router } from "express";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import { validate } from "../middlewares/validate";
import { createPlatformAuditLog } from "../lib/platform-audit";
import * as wlService from "../services/platform-white-label.service";
import { getBody } from "../lib/request-body";

const router = Router();

const adminRoles = requirePlatformRole("superAdmin", "platformAdmin");
const idParams = z.object({ id: z.string().uuid() });

const updateSchema = z.object({
  customDomain: z.string().max(255).nullable().optional(),
  brandNameOverride: z.string().max(255).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  primaryColor: z.string().max(20).nullable().optional(),
  secondaryColor: z.string().max(20).nullable().optional(),
  customSupportEmail: z.string().max(255).nullable().optional(),
  customSupportPhone: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get(
  "/platform/companies/:id/white-label",
  authenticate,
  adminRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const settings = await wlService.getWhiteLabelSettings(
      req.params.id as string,
    );
    await createPlatformAuditLog(req, {
      action: "platform.white_label.view",
      entityType: "white_label_settings",
      targetCompanyId: req.params.id as string,
    });
    res.json({ data: settings });
  },
);

router.patch(
  "/platform/companies/:id/white-label",
  authenticate,
  adminRoles,
  validate({ params: idParams, body: updateSchema }),
  async (req, res) => {
    const { settings, previous } = await wlService.upsertWhiteLabelSettings(
      req.params.id as string,
      getBody<z.infer<typeof updateSchema>>(req),
    );
    await createPlatformAuditLog(req, {
      action: "platform.white_label.update",
      entityType: "white_label_settings",
      targetCompanyId: req.params.id as string,
      before: previous,
      after: settings,
    });
    res.json({ data: settings });
  },
);

router.post(
  "/platform/companies/:id/white-label/enable",
  authenticate,
  adminRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const { settings, previous } = await wlService.enableWhiteLabel(
      req.params.id as string,
    );
    await createPlatformAuditLog(req, {
      action: "platform.white_label.enable",
      entityType: "white_label_settings",
      targetCompanyId: req.params.id as string,
      before: previous ? { status: previous.status } : null,
      after: { status: settings.status },
    });
    res.json({ data: settings });
  },
);

router.post(
  "/platform/companies/:id/white-label/disable",
  authenticate,
  adminRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const { settings, previous } = await wlService.disableWhiteLabel(
      req.params.id as string,
    );
    await createPlatformAuditLog(req, {
      action: "platform.white_label.disable",
      entityType: "white_label_settings",
      targetCompanyId: req.params.id as string,
      before: { status: previous.status },
      after: { status: settings.status },
    });
    res.json({ data: settings });
  },
);

export default router;
