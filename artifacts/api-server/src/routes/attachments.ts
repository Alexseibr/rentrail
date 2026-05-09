import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess } from "../middlewares/authorize";
import * as attachmentService from "../services/attachment.service";

const router: IRouter = Router();

const createSchema = z.object({
  entityType: z.enum(["incident", "maintenance", "rental", "asset"]),
  entityId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
  objectPath: z.string().min(1),
  tag: z.string().optional(),
  notes: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
});

const listQuerySchema = z.object({
  entityType: z.enum(["incident", "maintenance", "rental", "asset"]),
  entityId: z.string().uuid(),
});

router.post(
  "/attachments",
  authenticate,
  requireCompanyAccess,
  validate({ body: createSchema }),
  async (req, res) => {
    const {
      entityType,
      entityId,
      fileName,
      mimeType,
      fileSize,
      objectPath,
      tag,
      notes,
      capturedAt,
    } = req.body as z.infer<typeof createSchema>;
    const attachment = await attachmentService.createAttachment({
      companyId: req.tenant!.companyId,
      entityType,
      entityId,
      fileName,
      mimeType,
      fileSize,
      objectPath,
      tag,
      notes,
      uploadedBy: req.user!.userId,
      capturedAt: capturedAt ? new Date(capturedAt) : undefined,
    });
    res.status(201).json({ data: attachment });
  },
);

router.get(
  "/attachments",
  authenticate,
  requireCompanyAccess,
  validate({ query: listQuerySchema }),
  async (req, res) => {
    const list = await attachmentService.listAttachments(
      req.tenant!.companyId,
      req.query.entityType as string,
      req.query.entityId as string,
    );
    res.json({ data: list });
  },
);

router.get(
  "/attachments/:id",
  authenticate,
  requireCompanyAccess,
  async (req, res) => {
    const attachment = await attachmentService.getAttachment(
      req.params.id as string,
      req.tenant!.companyId,
    );
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    res.json({ data: attachment });
  },
);

router.delete(
  "/attachments/:id",
  authenticate,
  requireCompanyAccess,
  async (req, res) => {
    const deleted = await attachmentService.deleteAttachment(
      req.params.id as string,
      req.tenant!.companyId,
    );
    if (!deleted) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    res.json({ data: deleted });
  },
);

export default router;
