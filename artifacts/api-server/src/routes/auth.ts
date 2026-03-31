import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
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

router.get("/auth/me", authenticate, async (req, res) => {
  const user = await authService.getCurrentUser(req.user!.userId);
  res.json({ data: user });
});

export default router;
