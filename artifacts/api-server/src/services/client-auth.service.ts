import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db, clients, phoneOtpCodes } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { signAccessToken } from "../lib/jwt";
import { config } from "../lib/config";
import { ConflictError, NotFoundError, UnauthorizedError } from "../lib/errors";

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/-/g, "");
}
const OTP_TTL_MINUTES = 10;
const IS_DEV = process.env.NODE_ENV !== "production";
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signClientRefreshToken(client: {
  id: string;
  companyId: string;
  refreshTokenVersion: number;
}) {
  return jwt.sign(
    {
      clientId: client.id,
      companyId: client.companyId,
      tokenType: "client-refresh",
      version: client.refreshTokenVersion,
    },
    config.jwt.refreshSecret,
    { expiresIn: "30d" },
  );
}

export async function clientLoginWithPassword(
  rawPhone: string,
  password: string,
  companyId?: string,
) {
  const phone = normalizePhone(rawPhone);

  const conditions = companyId
    ? and(eq(clients.phone, rawPhone), eq(clients.companyId, companyId))
    : eq(clients.phone, rawPhone);

  let matchingClients = await db.select().from(clients).where(conditions);

  if (matchingClients.length === 0 && phone !== rawPhone) {
    const conditionsNorm = companyId
      ? and(eq(clients.phone, phone), eq(clients.companyId, companyId))
      : eq(clients.phone, phone);
    matchingClients = await db.select().from(clients).where(conditionsNorm);
  }

  const client =
    matchingClients.find((c) => c.status === "active") ?? matchingClients[0];

  if (!client) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  if (!client.passwordHash) {
    throw new UnauthorizedError("Password not set for this client account");
  }

  if (client.status !== "active") {
    throw new UnauthorizedError("Account is suspended or blocked");
  }

  const isValid = await bcrypt.compare(password, client.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  const accessToken = signAccessToken({
    userId: client.id,
    isSuperAdmin: false,
    platformRoles: [],
    clientId: client.id,
    companyId: client.companyId,
    tokenType: "client",
  });

  const refreshToken = signClientRefreshToken(client);

  return {
    accessToken,
    refreshToken,
    user: {
      id: client.id,
      clientId: client.id,
      companyId: client.companyId,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      tokenType: "client" as const,
    },
  };
}

export async function getClientProfile(clientId: string) {
  const [client] = await db
    .select({
      id: clients.id,
      companyId: clients.companyId,
      fullName: clients.fullName,
      phone: clients.phone,
      email: clients.email,
      status: clients.status,
      rating: clients.rating,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return null;

  return {
    ...client,
    tokenType: "client" as const,
  };
}

export async function clientRegisterWithPassword(input: {
  companyId: string;
  fullName: string;
  phone: string;
  password: string;
  email?: string;
}) {
  const phone = normalizePhone(input.phone);
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.companyId, input.companyId), eq(clients.phone, phone)),
    )
    .limit(1);
  if (existing)
    throw new ConflictError("Client with this phone already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [client] = await db
    .insert(clients)
    .values({
      companyId: input.companyId,
      fullName: input.fullName,
      phone,
      email: input.email ?? null,
      status: "active",
      passwordHash,
    })
    .returning();

  const accessToken = signAccessToken({
    userId: client.id,
    isSuperAdmin: false,
    platformRoles: [],
    clientId: client.id,
    companyId: client.companyId,
    tokenType: "client",
  });

  const refreshToken = signClientRefreshToken(client);

  return {
    accessToken,
    refreshToken,
    user: {
      id: client.id,
      clientId: client.id,
      companyId: client.companyId,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      tokenType: "client" as const,
    },
  };
}

export async function clientRequestOtp(rawPhone: string, companyId?: string) {
  const phone = normalizePhone(rawPhone);
  const conditions = companyId
    ? and(eq(clients.phone, phone), eq(clients.companyId, companyId))
    : eq(clients.phone, phone);
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(conditions)
    .limit(1);
  if (!client) throw new NotFoundError("Client not found");

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await db.insert(phoneOtpCodes).values({ phone, code, expiresAt });
  if (IS_DEV) return { sent: true, devCode: code };
  return { sent: true };
}

export async function clientVerifyOtpAndSetPassword(
  rawPhone: string,
  code: string,
  newPassword: string,
  companyId?: string,
) {
  const phone = normalizePhone(rawPhone);
  const [record] = await db
    .select()
    .from(phoneOtpCodes)
    .where(
      and(
        eq(phoneOtpCodes.phone, phone),
        eq(phoneOtpCodes.code, code),
        isNull(phoneOtpCodes.usedAt),
        gt(phoneOtpCodes.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!record) throw new UnauthorizedError("Invalid or expired OTP code");

  const conditions = companyId
    ? and(eq(clients.phone, phone), eq(clients.companyId, companyId))
    : eq(clients.phone, phone);
  const [client] = await db.select().from(clients).where(conditions).limit(1);
  if (!client) throw new NotFoundError("Client not found");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(clients)
    .set({ passwordHash, status: "active", updatedAt: new Date() })
    .where(eq(clients.id, client.id));
  await db
    .update(phoneOtpCodes)
    .set({ usedAt: new Date() })
    .where(eq(phoneOtpCodes.id, record.id));
  return { success: true };
}

export async function revokeClientRefreshTokens(clientId: string) {
  await db
    .update(clients)
    .set({
      refreshTokenVersion: sql`${clients.refreshTokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId));
}
