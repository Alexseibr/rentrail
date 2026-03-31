import bcrypt from "bcrypt";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db, users, sessions, userCompanyMemberships, userBranchMemberships, roles } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { config } from "../lib/config";
import { ConflictError, UnauthorizedError, NotFoundError } from "../lib/errors";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function register(input: RegisterInput) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Email already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, config.bcrypt.saltRounds);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    })
    .returning();

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export async function login(
  input: LoginInput,
  userAgent?: string,
  ip?: string,
): Promise<AuthTokens & { user: { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean; mustChangePassword: boolean } }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const rawRefreshToken = uuidv4();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs);

  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      refreshTokenHash,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      expiresAt,
    })
    .returning();

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  });

  const refreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
    tokenId: rawRefreshToken,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let payload: { userId: string; sessionId: string; tokenId: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, payload.sessionId),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Session expired or revoked");
  }

  const tokenHash = hashToken(payload.tokenId);
  if (session.refreshTokenHash !== tokenHash) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id));
    throw new UnauthorizedError("Token reuse detected — session revoked");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  const newRawToken = uuidv4();
  const newTokenHash = hashToken(newRawToken);
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs);

  const updated = await db
    .update(sessions)
    .set({ refreshTokenHash: newTokenHash, expiresAt })
    .where(
      and(
        eq(sessions.id, session.id),
        eq(sessions.refreshTokenHash, tokenHash),
      ),
    )
    .returning();

  if (updated.length === 0) {
    throw new UnauthorizedError("Concurrent refresh detected");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  });

  const newRefreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
    tokenId: newRawToken,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string, sessionId?: string): Promise<void> {
  if (sessionId) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  } else {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}

export async function getCurrentUser(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      isSuperAdmin: users.isSuperAdmin,
      mustChangePassword: users.mustChangePassword,
      twoFactorEnabled: users.twoFactorEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const memberships = await db
    .select({
      companyId: userCompanyMemberships.companyId,
      roleId: userCompanyMemberships.roleId,
      roleCode: roles.code,
      roleName: roles.name,
      status: userCompanyMemberships.status,
    })
    .from(userCompanyMemberships)
    .innerJoin(roles, eq(roles.id, userCompanyMemberships.roleId))
    .where(eq(userCompanyMemberships.userId, userId));

  const branchMemberships = await db
    .select({
      companyId: userBranchMemberships.companyId,
      branchId: userBranchMemberships.branchId,
      roleId: userBranchMemberships.roleId,
      roleCode: roles.code,
      roleName: roles.name,
      status: userBranchMemberships.status,
    })
    .from(userBranchMemberships)
    .innerJoin(roles, eq(roles.id, userBranchMemberships.roleId))
    .where(eq(userBranchMemberships.userId, userId));

  return {
    ...user,
    memberships,
    branchMemberships,
  };
}
