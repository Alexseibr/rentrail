import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import jwt from "jsonwebtoken";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess } from "../middlewares/authorize";
import * as authService from "../services/auth.service";
import * as phoneAuthService from "../services/phone-auth.service";
import * as emailAuthService from "../services/email-auth.service";
import * as clientAuthService from "../services/client-auth.service";
import { config } from "../lib/config";
import { signAccessToken } from "../lib/jwt";
import { db, clients } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getBody } from "../lib/request-body";

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

const emailRequestOtpSchema = z.object({
  email: z.string().email(),
});

const emailVerifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/auth/register",
  validate({ body: registerSchema }),
  async (req, res) => {
    const user = await authService.register(
      getBody<z.infer<typeof registerSchema>>(req),
    );
    res.status(201).json({ data: user });
  },
);

router.post(
  "/auth/login",
  validate({ body: loginSchema }),
  async (req, res) => {
    const result = await authService.login(
      getBody<z.infer<typeof loginSchema>>(req),
      req.headers["user-agent"],
      req.ip,
    );
    res.json({ data: result });
  },
);

router.post(
  "/auth/phone/request-otp",
  validate({ body: phoneRequestOtpSchema }),
  async (req, res) => {
    const { phone } = getBody<z.infer<typeof phoneRequestOtpSchema>>(req);
    const result = await phoneAuthService.requestOtp(phone);
    res.json({ data: result });
  },
);

router.post(
  "/auth/phone/verify-otp",
  validate({ body: phoneVerifyOtpSchema }),
  async (req, res) => {
    const { phone, code } = getBody<z.infer<typeof phoneVerifyOtpSchema>>(req);
    const result = await phoneAuthService.verifyOtp(
      phone,
      code,
      req.headers["user-agent"],
      req.ip,
    );
    res.json({ data: result });
  },
);

router.post(
  "/auth/phone/login",
  validate({ body: phoneLoginSchema }),
  async (req, res) => {
    const { phone, password } = getBody<z.infer<typeof phoneLoginSchema>>(req);
    const result = await phoneAuthService.loginWithPassword(
      phone,
      password,
      req.headers["user-agent"],
      req.ip,
    );
    res.json({ data: result });
  },
);

router.post(
  "/auth/phone/set-password",
  authenticate,
  validate({ body: setPasswordSchema }),
  async (req, res) => {
    const { password } = getBody<z.infer<typeof setPasswordSchema>>(req);
    await phoneAuthService.setPassword(req.user!.userId, password);
    res.json({ data: { message: "Password set successfully" } });
  },
);

router.post(
  "/auth/email/request-otp",
  validate({ body: emailRequestOtpSchema }),
  async (req, res) => {
    const { email } = getBody<z.infer<typeof emailRequestOtpSchema>>(req);
    const result = await emailAuthService.requestEmailOtp(email);
    res.json({ data: result });
  },
);

router.post(
  "/auth/email/verify-otp",
  validate({ body: emailVerifyOtpSchema }),
  async (req, res) => {
    const { email, code } = getBody<z.infer<typeof emailVerifyOtpSchema>>(req);
    const result = await emailAuthService.verifyEmailOtp(
      email,
      code,
      req.headers["user-agent"],
      req.ip,
    );
    res.json({ data: result });
  },
);

router.post(
  "/auth/email/login",
  validate({ body: emailLoginSchema }),
  async (req, res) => {
    const { email, password } = getBody<z.infer<typeof emailLoginSchema>>(req);
    const result = await emailAuthService.loginWithEmailPassword(
      email,
      password,
      req.headers["user-agent"],
      req.ip,
    );
    res.json({ data: result });
  },
);

router.post(
  "/auth/email/set-password",
  authenticate,
  validate({ body: setPasswordSchema }),
  async (req, res) => {
    const { password } = getBody<z.infer<typeof setPasswordSchema>>(req);
    await emailAuthService.setEmailPassword(req.user!.userId, password);
    res.json({ data: { message: "Password set successfully" } });
  },
);

router.post(
  "/auth/refresh",
  validate({ body: refreshSchema }),
  async (req, res) => {
    const { refreshToken } = getBody<z.infer<typeof refreshSchema>>(req);
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ data: tokens });
  },
);

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

router.post(
  "/auth/client/login",
  validate({ body: clientLoginSchema }),
  async (req, res) => {
    const { phone, password, companyId } =
      getBody<z.infer<typeof clientLoginSchema>>(req);
    const result = await clientAuthService.clientLoginWithPassword(
      phone,
      password,
      companyId,
    );
    res.json({ data: result });
  },
);

const clientRefreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post(
  "/auth/client/refresh",
  validate({ body: clientRefreshSchema }),
  async (req, res) => {
    try {
      const { refreshToken } =
        getBody<z.infer<typeof clientRefreshSchema>>(req);
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
        clientId: string;
        companyId: string;
        tokenType: string;
      };
      if (payload.tokenType !== "client-refresh") {
        res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Invalid refresh token" },
        });
        return;
      }
      const [client] = await db
        .select({ id: clients.id, status: clients.status })
        .from(clients)
        .where(eq(clients.id, payload.clientId))
        .limit(1);
      if (!client || client.status !== "active") {
        res.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Client not found or suspended",
          },
        });
        return;
      }
      const accessToken = signAccessToken({
        userId: payload.clientId,
        isSuperAdmin: false,
        platformRoles: [],
        clientId: payload.clientId,
        companyId: payload.companyId,
        tokenType: "client",
      });
      res.json({ data: { accessToken } });
    } catch {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired refresh token",
        },
      });
    }
  },
);

router.get("/auth/client/me", authenticate, async (req, res) => {
  if (!req.user?.clientId) {
    res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Not a client token" } });
    return;
  }
  const profile = await clientAuthService.getClientProfile(req.user.clientId);
  if (!profile) {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Client not found" } });
    return;
  }
  res.json({ data: profile });
});

router.get(
  "/auth/permissions",
  authenticate,
  requireCompanyAccess,
  async (req, res) => {
    const perms = Array.from(req.tenant!.permissions);
    res.json({
      data: {
        companyId: req.tenant!.companyId,
        roleCode: req.tenant!.membership.roleCode,
        permissions: perms,
      },
    });
  },
);

export default router;
