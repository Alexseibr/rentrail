import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";
import * as notificationService from "../services/notification.service";

const router: IRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

router.get(
  "/notifications",
  authenticate,
  requireCompanyAccess,
  requirePermission("notification:read"),
  async (req, res) => {
    const notifications = await notificationService.listUserNotifications(
      req.user!.userId,
      req.tenant!.companyId,
    );
    res.json({ data: notifications });
  },
);

router.post(
  "/notifications/:id/read",
  authenticate,
  requireCompanyAccess,
  requirePermission("notification:read"),
  validate({ params: idParams }),
  async (req, res) => {
    const notification = await notificationService.markRead(
      req.params.id as string,
      req.user!.userId,
    );
    res.json({
      data: notification ?? { message: "Already read or not found" },
    });
  },
);

router.post(
  "/notifications/read-all",
  authenticate,
  requireCompanyAccess,
  requirePermission("notification:read"),
  async (req, res) => {
    await notificationService.markAllRead(
      req.user!.userId,
      req.tenant!.companyId,
    );
    res.json({ data: { message: "All notifications marked as read" } });
  },
);

export default router;
