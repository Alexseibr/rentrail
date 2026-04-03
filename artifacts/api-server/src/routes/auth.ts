import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess } from "../middlewares/authorize";
import * as authService from "../services/auth.service";
import * as phoneAuthService from "../services/phone-auth.service";
import * as clientAuthService from "../services/client-auth.service";

const router: IRouter = Router();

const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const phoneRequestOtpSchema = z.object({
  phone: z.string().min(7),
});

const phoneVerifyOtpSchema = z.object({
  phone: z.string().min(7),
  code: z.string().length(6),
});

const phoneLoginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(1),
});

const setPasswordSchema = z.object({
  password: z.string().min(6),
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

router.post("/auth/phone/request-otp", validate({ body: phoneRequestOtpSchema }), async (req, res) => {
  const result = await phoneAuthService.requestOtp(req.body.phone);
  res.json({ data: result });
});

router.post("/auth/phone/verify-otp", validate({ body: phoneVerifyOtpSchema }), async (req, res) => {
  const result = await phoneAuthService.verifyOtp(
    req.body.phone,
    req.body.code,
    req.headers["user-agent"],
    req.ip,
  );
  res.json({ data: result });
});

router.post("/auth/phone/login", validate({ body: phoneLoginSchema }), async (req, res) => {
  const result = await phoneAuthService.loginWithPassword(
    req.body.phone,
    req.body.password,
    req.headers["user-agent"],
    req.ip,
  );
  res.json({ data: result });
});

router.post("/auth/phone/set-password", authenticate, validate({ body: setPasswordSchema }), async (req, res) => {
  await phoneAuthService.setPassword(req.user!.userId, req.body.password);
  res.json({ data: { message: "Password set successfully" } });
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

const clientLoginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(1),
  companyId: z.string().uuid().optional(),
});

router.post("/auth/client/login", validate({ body: clientLoginSchema }), async (req, res) => {
  const result = await clientAuthService.clientLoginWithPassword(
    req.body.phone,
    req.body.password,
    req.body.companyId,
  );
  res.json({ data: result });
});

router.get("/auth/client/me", authenticate, async (req, res) => {
  if (!req.user?.clientId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Not a client token" } });
    return;
  }
  const profile = await clientAuthService.getClientProfile(req.user.clientId);
  if (!profile) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
    return;
  }
  res.json({ data: profile });
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
