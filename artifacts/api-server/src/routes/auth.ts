import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess } from "../middlewares/authorize";
import * as authService from "../services/auth.service";

const router: IRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/auth/register", validate({ body: registerSchema }), async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ data: user });
});

router.post("/auth/login", validate({ body: loginSchema }), async (req, res) => {
  const result = await authService.login(
    req.body,
    req.headers["user-agent"],
    req.ip,
  );
  res.json({ data: result });
});

router.post("/auth/refresh", validate({ body: refreshSchema }), async (req, res) => {
  const tokens = await authService.refreshTokens(req.body.refreshToken);
  res.json({ data: tokens });
});

router.post("/auth/logout", authenticate, async (req, res) => {
  await authService.logout(req.user!.userId);
  res.json({ data: { message: "Logged out" } });
});

router.post("/auth/logout-all", authenticate, async (req, res) => {
  await authService.logout(req.user!.userId);
  res.json({ data: { message: "All sessions revoked" } });
});

router.get("/auth/me", authenticate, async (req, res) => {
  const user = await authService.getCurrentUser(req.user!.userId);
  res.json({ data: user });
});

router.get("/auth/permissions", authenticate, requireCompanyAccess, async (req, res) => {
  const perms = Array.from(req.tenant!.permissions);
  res.json({
    data: {
      companyId: req.tenant!.companyId,
      roleCode: req.tenant!.membership.roleCode,
      permissions: perms,
    },
  });
});

export default router;
