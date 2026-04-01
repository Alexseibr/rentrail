import bcrypt from "bcrypt";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db, users, sessions, phoneOtpCodes } from "@workspace/db";
import { eq, and, isNull, lt, gt } from "drizzle-orm";
import { signAccessToken, signRefreshToken } from "../lib/jwt";
import { config } from "../lib/config";
import { UnauthorizedError, NotFoundError, BadRequestError, ConflictError } from "../lib/errors";
import { loadUserPlatformRoles } from "../lib/platform-roles";

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const IS_DEV = process.env.NODE_ENV !== "production";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/-/g, "");
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createSession(userId: string, userAgent?: string, ip?: string) {
  const rawRefreshToken = uuidv4();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs);

  const [session] = await db
    .insert(sessions)
    .values({ userId, refreshTokenHash, userAgent: userAgent ?? null, ip: ip ?? null, expiresAt })
    .returning();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const platformRoles = await loadUserPlatformRoles(userId);

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email ?? undefined,
    isSuperAdmin: user.isSuperAdmin || platformRoles.includes("superAdmin"),
    platformRoles,
  });

  const refreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
    tokenId: rawRefreshToken,
  });

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function requestOtp(
  rawPhone: string,
): Promise<{ sent: boolean; devCode?: string }> {
  const phone = normalizePhone(rawPhone);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user) {
    throw new NotFoundError("Phone number not registered");
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.insert(phoneOtpCodes).values({ phone, code, expiresAt });

  if (IS_DEV) {
    console.log(`[DEV] OTP for ${phone}: ${code}`);
    return { sent: true, devCode: code };
  }

  return { sent: true };
}

export async function verifyOtp(
  rawPhone: string,
  code: string,
  userAgent?: string,
  ip?: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: object;
  needsPassword: boolean;
}> {
  const phone = normalizePhone(rawPhone);
  const now = new Date();

  const [record] = await db
    .select()
    .from(phoneOtpCodes)
    .where(
      and(
        eq(phoneOtpCodes.phone, phone),
        isNull(phoneOtpCodes.usedAt),
        gt(phoneOtpCodes.expiresAt, now),
      ),
    )
    .orderBy(phoneOtpCodes.createdAt)
    .limit(1);

  if (!record) {
    throw new UnauthorizedError("OTP code expired or not found");
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new UnauthorizedError("Too many incorrect attempts");
  }

  if (record.code !== code) {
    await db
      .update(phoneOtpCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(phoneOtpCodes.id, record.id));
    throw new UnauthorizedError("Invalid OTP code");
  }

  await db
    .update(phoneOtpCodes)
    .set({ usedAt: now })
    .where(eq(phoneOtpCodes.id, record.id));

  await db
    .update(users)
    .set({ phoneVerified: true })
    .where(eq(users.phone, phone));

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const session = await createSession(user.id, userAgent, ip);

  return {
    ...session,
    needsPassword: !user.passwordHash,
  };
}

export async function loginWithPassword(
  rawPhone: string,
  password: string,
  userAgent?: string,
  ip?: string,
) {
  const phone = normalizePhone(rawPhone);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  if (!user.passwordHash) {
    throw new UnauthorizedError("Password not set. Please use OTP login first.");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  return createSession(user.id, userAgent, ip);
}

export async function setPassword(
  userId: string,
  password: string,
): Promise<void> {
  if (password.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
