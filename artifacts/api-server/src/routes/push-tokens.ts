import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import * as pushTokenService from "../services/push-token.service";

const router: IRouter = Router();

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().optional(),
  deviceId: z.string().optional(),
  companyId: z.string().uuid().optional(),
});

const unregisterSchema = z.object({
  token: z.string().min(1),
});

router.post(
  "/push/register",
  authenticate,
  validate({ body: registerSchema }),
  async (req, res) => {
    const result = await pushTokenService.registerToken({
      userId: req.user!.userId,
      companyId: req.body.companyId,
      token: req.body.token,
      platform: req.body.platform,
      appVersion: req.body.appVersion,
      deviceId: req.body.deviceId,
    });
    res.json({ data: result });
  },
);

router.post(
  "/push/unregister",
  authenticate,
  validate({ body: unregisterSchema }),
  async (req, res) => {
    const result = await pushTokenService.unregisterToken(
      req.body.token,
      req.user!.userId,
    );
    if (!result) {
      res.status(404).json({ error: "Token not found" });
      return;
    }
    res.json({ data: { message: "Token unregistered" } });
  },
);

export default router;
