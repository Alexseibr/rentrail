import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { db, users, sessions, userCompanyMemberships, userBranchMemberships, roles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { config } from "../lib/config";
import { ConflictError, UnauthorizedError, NotFoundError } from "../lib/errors";

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

export async function login(input: LoginInput, userAgent?: string, ipAddress?: string): Promise<AuthTokens & { user: { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean } }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Account is deactivated");
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const refreshTokenStr = uuidv4();
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs);

  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      refreshToken: refreshTokenStr,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
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
    },
  };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, payload.sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Session expired");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new UnauthorizedError("User not found or inactive");
  }

  const newRefreshTokenStr = uuidv4();
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs);

  await db
    .update(sessions)
    .set({ refreshToken: newRefreshTokenStr, expiresAt })
    .where(eq(sessions.id, session.id));

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  });

  const newRefreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string, refreshToken: string): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId)));
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
      isActive: users.isActive,
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
      roleName: roles.name,
      roleDisplayName: roles.displayName,
    })
    .from(userCompanyMemberships)
    .innerJoin(roles, eq(roles.id, userCompanyMemberships.roleId))
    .where(eq(userCompanyMemberships.userId, userId));

  const branchMemberships = await db
    .select({
      branchId: userBranchMemberships.branchId,
    })
    .from(userBranchMemberships)
    .where(eq(userBranchMemberships.userId, userId));

  return {
    ...user,
    memberships,
    branchMemberships,
  };
}
